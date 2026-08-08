//! Windows 系统音频（扬声器输出 / loopback）采集模块
//!
//! 通过 WASAPI loopback 采集默认渲染设备（扬声器/耳机）的输出音频，
//! 以 16bit PCM / 48kHz / 双声道 的格式写入 WAV 文件。
//! ffmpeg 的 dshow 无法直接采集系统音频（需要虚拟声卡），因此由 Rust
//! 侧通过 WASAPI loopback 完成采集，段录制结束后再合成进视频。
#![cfg(target_os = "windows")]

use std::fs::File;
use std::io::{Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use windows::Win32::Media::Audio::{
    eConsole, eRender, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
    AUDCLNT_STREAMFLAGS_LOOPBACK, IAudioCaptureClient, IAudioClient, IMMDevice,
    IMMDeviceEnumerator, MMDeviceEnumerator, WAVE_FORMAT_PCM, WAVEFORMATEX,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};

/// 采集使用的采样率
const SAMPLE_RATE: u32 = 48000;
/// 采集使用的声道数
const CHANNELS: u16 = 2;
/// 采集使用的位深
const BITS_PER_SAMPLE: u16 = 16;
/// 单个采样帧的字节数（声道数 * 位深 / 8）
const BLOCK_ALIGN: u16 = CHANNELS * BITS_PER_SAMPLE / 8;

/// 系统音频采集器
///
/// 通过 WASAPI loopback 在独立线程中采集系统音频并写入 WAV 文件，
/// [`Self::stop`] 停止采集并完成 WAV 文件（补全文件头长度信息）。
pub struct SystemAudioCapture {
    stop_flag: Arc<AtomicBool>,
    join_handle: Option<JoinHandle<()>>,
    /// 采集线程创建时刻
    created_at: Instant,
    /// 采集流实际开始时刻（WAV 时间戳 0 对应的真实时刻，由采集线程回填）
    actual_started_at: Arc<Mutex<Option<Instant>>>,
}

impl SystemAudioCapture {
    /// 启动系统音频采集，写入 `output_file`（WAV 格式）
    ///
    /// 立即返回，采集在后台线程进行；采集失败（如无音频设备）只记录日志，
    /// 不会阻塞调用方。可通过 [`Self::stop`] 停止。
    pub fn start(output_file: PathBuf) -> std::io::Result<Self> {
        let stop_flag = Arc::new(AtomicBool::new(false));
        let thread_stop_flag = Arc::clone(&stop_flag);
        let actual_started_at = Arc::new(Mutex::new(None));
        let thread_started_at = Arc::clone(&actual_started_at);

        let created_at = Instant::now();
        let join_handle = std::thread::Builder::new()
            .name("system-audio-capture".to_string())
            .spawn(move || {
                if let Err(e) = capture_loop(thread_stop_flag, thread_started_at, &output_file) {
                    log::error!(
                        "[SystemAudioCapture] Failed to capture system audio to {}: {}",
                        output_file.display(),
                        e
                    );
                }
            })?;

        Ok(Self {
            stop_flag,
            join_handle: Some(join_handle),
            created_at,
            actual_started_at,
        })
    }

    /// 采集流开始时刻（WAV 时间戳 0 对应的真实时刻）
    ///
    /// 用于音画对齐：将系统音频的时间戳补偿到与视频录制起点一致。
    /// 若采集流尚未实际启动（异常情况），回退到线程创建时刻。
    pub fn started_at(&self) -> Instant {
        if let Ok(guard) = self.actual_started_at.lock() {
            if let Some(started_at) = *guard {
                return started_at;
            }
        }

        self.created_at
    }

    /// 停止采集并完成 WAV 文件
    pub fn stop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);

        if let Some(handle) = self.join_handle.take() {
            let _ = handle.join();
        }
    }
}

impl Drop for SystemAudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}

/// 采集线程主体：初始化 WASAPI loopback 并循环读取音频数据写入 WAV
fn capture_loop(
    stop_flag: Arc<AtomicBool>,
    started_at: Arc<Mutex<Option<Instant>>>,
    output_file: &std::path::Path,
) -> windows::core::Result<()> {
    // COM 必须在采集线程中初始化（MTA 即可）
    unsafe {
        CoInitializeEx(None, COINIT_MULTITHREADED).ok()?;
    }

    let result = capture_inner(stop_flag, started_at, output_file);

    unsafe {
        CoUninitialize();
    }

    result
}

fn capture_inner(
    stop_flag: Arc<AtomicBool>,
    started_at: Arc<Mutex<Option<Instant>>>,
    output_file: &std::path::Path,
) -> windows::core::Result<()> {
    // 1. 获取默认渲染设备（loopback 必须基于渲染端点）
    let enumerator: IMMDeviceEnumerator = unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)? };
    let device: IMMDevice = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole)? };

    // 2. 激活 IAudioClient 并以 loopback 模式初始化
    let client: IAudioClient = unsafe { device.Activate(CLSCTX_ALL, None)? };

    let format = WAVEFORMATEX {
        wFormatTag: WAVE_FORMAT_PCM as u16,
        nChannels: CHANNELS,
        nSamplesPerSec: SAMPLE_RATE,
        nAvgBytesPerSec: SAMPLE_RATE * u32::from(BLOCK_ALIGN),
        nBlockAlign: BLOCK_ALIGN,
        wBitsPerSample: BITS_PER_SAMPLE,
        cbSize: 0,
    };

    // 共享模式 + loopback，缓冲时长传 0（使用系统默认）
    unsafe {
        client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            0,
            0,
            &format,
            None,
        )?;
    }

    let capture: IAudioCaptureClient = unsafe { client.GetService()? };
    let buffer_size = unsafe { client.GetBufferSize()? };

    // 3. 创建 WAV 文件（先写占位头，结束时回填长度）
    let mut file = File::create(output_file)?;
    write_wav_header(&mut file, 0)?;
    let mut total_data_bytes: u64 = 0;

    unsafe {
        client.Start()?;
    }

    // 回填采集流实际开始时刻（供音画对齐使用）
    if let Ok(mut guard) = started_at.lock() {
        *guard = Some(Instant::now());
    }

    log::info!(
        "[SystemAudioCapture] Started capturing system audio to {} (buffer size: {} frames)",
        output_file.display(),
        buffer_size
    );

    // 4. 轮询读取音频数据
    loop {
        if stop_flag.load(Ordering::Relaxed) {
            break;
        }

        let padding = unsafe { client.GetCurrentPadding() }?;
        let available = buffer_size.saturating_sub(padding);

        if available == 0 {
            std::thread::sleep(Duration::from_millis(10));
            continue;
        }

        let mut data: *mut u8 = std::ptr::null_mut();
        let mut frames: u32 = 0;
        let mut flags: u32 = 0;

        let get_result = unsafe {
            capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None)
        };

        if let Err(e) = get_result {
            log::error!("[SystemAudioCapture] GetBuffer failed: {}", e);
            break;
        }

        if frames > 0 {
            let bytes = frames as usize * BLOCK_ALIGN as usize;

            if flags & (AUDCLNT_BUFFERFLAGS_SILENT.0 as u32) != 0 {
                // 静音帧：写入零数据，避免未初始化内容
                write_zeros(&mut file, bytes)?;
            } else {
                // 从 WASAPI 缓冲读取的音频数据仅在 ReleaseBuffer 前有效
                let slice = unsafe { std::slice::from_raw_parts(data, bytes) };
                file.write_all(slice)?;
            }

            total_data_bytes += bytes as u64;
        }

        unsafe {
            capture.ReleaseBuffer(frames)?;
        }
    }

    unsafe {
        client.Stop()?;
    }

    // 5. 回填 WAV 头中的长度信息
    file.flush()?;
    write_wav_header(&mut file, total_data_bytes)?;
    file.flush()?;

    log::info!(
        "[SystemAudioCapture] Finished capturing system audio, {} bytes written to {}",
        total_data_bytes,
        output_file.display()
    );

    Ok(())
}

/// 写入标准 PCM WAV 头（44 字节）
fn write_wav_header(file: &mut File, data_len: u64) -> std::io::Result<()> {
    let data_len = data_len as u32;

    file.seek(SeekFrom::Start(0))?;
    file.write_all(b"RIFF")?;
    file.write_all(&(36 + data_len).to_le_bytes())?;
    file.write_all(b"WAVE")?;
    file.write_all(b"fmt ")?;
    file.write_all(&16u32.to_le_bytes())?; // fmt chunk 大小
    file.write_all(&(WAVE_FORMAT_PCM as u16).to_le_bytes())?; // PCM
    file.write_all(&CHANNELS.to_le_bytes())?;
    file.write_all(&SAMPLE_RATE.to_le_bytes())?;
    file.write_all(&(SAMPLE_RATE * u32::from(BLOCK_ALIGN)).to_le_bytes())?; // nAvgBytesPerSec
    file.write_all(&BLOCK_ALIGN.to_le_bytes())?;
    file.write_all(&BITS_PER_SAMPLE.to_le_bytes())?;
    file.write_all(b"data")?;
    file.write_all(&data_len.to_le_bytes())?;

    Ok(())
}

/// 写入 `count` 个零字节（静音帧）
fn write_zeros(file: &mut File, count: usize) -> std::io::Result<()> {
    const ZERO_BUF: [u8; 4096] = [0u8; 4096];

    let mut remaining = count;
    while remaining > 0 {
        let to_write = remaining.min(ZERO_BUF.len());
        file.write_all(&ZERO_BUF[..to_write])?;
        remaining -= to_write;
    }

    Ok(())
}
