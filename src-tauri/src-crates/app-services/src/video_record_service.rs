use ffmpeg_sidecar::{child::FfmpegChild, command::FfmpegCommand, event::FfmpegEvent};
use regex::Regex;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use crate::system_audio_capture::SystemAudioCapture;
#[cfg(target_os = "macos")]
use snow_shot_app_utils::monitor_info::MonitorList;
use std::{
    io::Result,
    path::{Path, PathBuf},
};
#[cfg(target_os = "windows")]
use std::time::Instant;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Copy)]
pub enum VideoRecordState {
    Idle,
    Recording,
    Paused,
}

/// 根据预设值获取基于CRF/global_quality参数的编码器质量值
/// 适用于AV1、VP9、H264_QSV等使用global_quality参数的编码器
///
/// # 参数
/// * `preset` - 编码器预设值
///
/// # 返回
/// global_quality参数值 (0-51, **值越小质量越高**)
///
/// # 质量说明
/// * 18: 高质量（压缩率低），慢速编码
/// * 22: 平衡质量
/// * 28: 低质量（压缩率高），快速编码
fn get_global_quality(preset: &str) -> i32 {
    match preset {
        "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" => 28,
        "medium" => 22,
        "slow" | "slower" => 18,
        "veryslow" | "placebo" => 16,
        _ => 22,
    }
}

/// 根据预设值获取MPEG4编码器的qscale值
///
/// # 参数
/// * `preset` - 编码器预设值
///
/// # 返回
/// qscale参数值 (1-31, **值越小质量越高**)
///
/// # 质量说明
/// * 4: 较高质量（压缩率较低），默认平衡值
/// * 5: 中等质量
/// * 6: 较低质量（压缩率较高）
/// * 7: 低质量（压缩率很高）
fn get_mpeg4_quality(preset: &str) -> i32 {
    match preset {
        "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" => 4,
        "medium" => 5,
        "slow" | "slower" => 6,
        "veryslow" | "placebo" => 7,
        _ => 4,
    }
}

/// 根据预设值获取ProRes编码器的profile值
///
/// # 参数
/// * `preset` - 编码器预设值
///
/// # 返回
/// profile参数值 (0-3)
///
/// # Profile说明 (FFmpeg prores编码器)
/// * 0: Proxy (最低质量,最高压缩率)
/// * 1: LT (低质量,中高压缩率)
/// * 2: Standard (默认,平衡)
/// * 3: Normal (高质量,低压缩率)
fn get_prores_quality(preset: &str) -> i32 {
    match preset {
        "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" => 0,
        "medium" => 1,
        "slow" | "slower" => 2,
        "veryslow" | "placebo" => 3,
        _ => 2,
    }
}

#[derive(PartialEq, Serialize, Deserialize, Debug, Clone, Copy)]
pub enum VideoFormat {
    Mp4,
    Gif,
}

impl VideoFormat {
    pub fn extension(&self) -> &str {
        match self {
            VideoFormat::Mp4 => "mp4",
            VideoFormat::Gif => "gif",
        }
    }
}

// 录制参数结构体，用于在暂停后恢复录制时重用参数
#[derive(Clone, Debug)]
struct RecordingParams {
    min_x: i32,
    min_y: i32,
    max_x: i32,
    max_y: i32,
    output_file: String,
    format: VideoFormat,
    frame_rate: u32,
    enable_microphone: bool,
    // macOS 上系统音频暂由 avfoundation 处理（enable_system_audio 仅 Windows 使用）
    #[cfg_attr(target_os = "macos", allow(unused))]
    enable_system_audio: bool,
    microphone_device_name: String,
    hwaccel: bool,
    encoder: String,
    encoder_preset: String,
    video_max_width: i32,
    video_max_height: i32,
}

pub struct VideoRecordService {
    pub state: VideoRecordState,
    pub child: Option<FfmpegChild>,
    // 片段管理相关字段
    segments: Vec<String>,                     // 存储所有片段文件路径
    segment_counter: u32,                      // 片段计数器
    recording_params: Option<RecordingParams>, // 录制参数，用于恢复录制
    record_video_size: Option<(i32, i32)>,     // 录制视频大小
    ffmpeg_path: Option<PathBuf>,
    // 系统音频采集（Windows WASAPI loopback），当前片段结束后合成进视频
    #[cfg(target_os = "windows")]
    system_audio_capture: Option<SystemAudioCapture>,
    #[cfg(target_os = "windows")]
    current_segment_audio_file: Option<PathBuf>,
    // 当前片段视频录制起点（ffmpeg spawn 时刻），用于系统音频时间戳对齐
    #[cfg(target_os = "windows")]
    current_segment_video_start: Option<Instant>,
    // 当前片段是否包含麦克风音轨（录制期记录，用于混音分支判断）
    #[cfg(target_os = "windows")]
    current_segment_has_audio: Option<bool>,
}

#[cfg(target_os = "macos")]
#[derive(PartialEq, Serialize, Deserialize, Debug, Clone, Copy)]
pub enum DeviceType {
    Audio,
    Video,
}

#[cfg(target_os = "macos")]
#[derive(PartialEq, Serialize, Deserialize, Debug, Clone)]
pub struct DeviceInfo {
    pub name: String,
    pub index: usize,
    pub device_type: DeviceType,
}

impl VideoRecordService {
    pub fn new() -> Self {
        Self {
            state: VideoRecordState::Idle,
            child: None,
            segments: Vec::new(),
            segment_counter: 0,
            recording_params: None,
            record_video_size: None,
            ffmpeg_path: None,
            #[cfg(target_os = "windows")]
            system_audio_capture: None,
            #[cfg(target_os = "windows")]
            current_segment_audio_file: None,
            #[cfg(target_os = "windows")]
            current_segment_video_start: None,
            #[cfg(target_os = "windows")]
            current_segment_has_audio: None,
        }
    }

    pub fn init(&mut self, ffmpeg_plugin_dir: &Path) {
        if self.ffmpeg_path.is_none() {
            #[cfg(target_os = "windows")]
            {
                self.ffmpeg_path = Some(ffmpeg_plugin_dir.join("ffmpeg.exe"));
            }

            #[cfg(target_os = "macos")]
            {
                use std::fs;
                use std::os::unix::fs::PermissionsExt;

                let ffmpeg_path = ffmpeg_plugin_dir.join("ffmpeg");

                // 为 ffmpeg 文件添加可执行权限
                if ffmpeg_path.exists() {
                    if let Ok(metadata) = fs::metadata(&ffmpeg_path) {
                        let mut permissions = metadata.permissions();
                        permissions.set_mode(0o755); // 设置可执行权限 (rwxr-xr-x)

                        if let Err(e) = fs::set_permissions(&ffmpeg_path, permissions) {
                            eprintln!(
                                "[VideoRecordService] Failed to set executable permissions for ffmpeg: {}",
                                e
                            );
                        } else {
                            println!(
                                "[VideoRecordService] Successfully set executable permissions for ffmpeg"
                            );
                        }
                    }
                }

                self.ffmpeg_path = Some(ffmpeg_path);
            }
        }
    }

    pub fn get_ffmpeg_command(&self) -> FfmpegCommand {
        FfmpegCommand::new_with_path(
            self.ffmpeg_path
                .as_ref()
                .expect("[VideoRecordService] valid ffmpeg path"),
        )
    }

    fn get_actual_video_size(
        &self,
        width: i32,
        height: i32,
        video_max_width: i32,
        video_max_height: i32,
    ) -> (i32, i32) {
        if width > video_max_width || height > video_max_height {
            // 计算保持宽高比的最大尺寸
            let max_width = video_max_width;
            let max_height = video_max_height;

            let scale_x = max_width as f64 / width as f64;
            let scale_y = max_height as f64 / height as f64;

            let target_size_scale = scale_x.min(scale_y);

            let mut target_width = (width as f64 * target_size_scale) as i32;
            let mut target_height = (height as f64 * target_size_scale) as i32;

            if target_width % 2 == 1 {
                target_width -= 1;
            }
            if target_height % 2 == 1 {
                target_height -= 1;
            }

            (target_width, target_height)
        } else {
            (width, height)
        }
    }

    pub fn start(
        &mut self,
        min_x: i32,
        min_y: i32,
        max_x: i32,
        max_y: i32,
        output_file: String,
        format: VideoFormat,
        frame_rate: u32,
        enable_microphone: bool,
        enable_system_audio: bool,
        microphone_device_name: String,
        hwaccel: bool,
        encoder: String,
        encoder_preset: String,
        video_max_width: i32,
        video_max_height: i32,
    ) -> Result<()> {
        if self.state == VideoRecordState::Recording {
            return Err(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                "Recording is already in progress",
            ));
        }

        // 保存录制参数
        self.recording_params = Some(RecordingParams {
            min_x,
            min_y,
            max_x,
            max_y,
            output_file: output_file.clone(),
            format,
            frame_rate,
            enable_microphone,
            enable_system_audio,
            microphone_device_name,
            hwaccel,
            encoder,
            encoder_preset,
            video_max_width,
            video_max_height,
        });

        // 重置片段相关状态
        self.segments.clear();
        self.segment_counter = 0;
        self.record_video_size = None;

        // 开始第一个片段的录制
        self.start_segment()
    }

    fn start_segment(&mut self) -> Result<()> {
        let params = self.recording_params.as_ref().unwrap();

        // 计算录制区域的宽度和高度
        let mut width = params.max_x - params.min_x;
        let mut height = params.max_y - params.min_y;

        if width <= 0 || height <= 0 {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Invalid recording area dimensions",
            ));
        }

        // 确保宽度和高度都是偶数（libx264要求）
        if width % 2 == 1 {
            width -= 1;
        }
        if height % 2 == 1 {
            height -= 1;
        }

        println!(
            "Recording segment {} area: {}x{} at ({}, {})",
            self.segment_counter + 1,
            width,
            height,
            params.min_x,
            params.min_y
        );

        let mut command = self.get_ffmpeg_command();

        // 硬件加速选项必须在输入选项之前
        if params.hwaccel {
            command.arg("-hwaccel").arg("auto");
        }

        // 根据平台设置不同的输入格式
        #[cfg(target_os = "windows")]
        {
            // Windows 使用 gdigrab
            command
                .arg("-f")
                .arg("gdigrab")
                .arg("-framerate")
                .arg(params.frame_rate.to_string())
                // 设置偏移量
                .arg("-offset_x")
                .arg(params.min_x.to_string())
                .arg("-offset_y")
                .arg(params.min_y.to_string())
                // 设置录制区域大小
                .arg("-video_size")
                .arg(format!("{}x{}", width, height))
                // 输入源为桌面
                .arg("-i")
                .arg("desktop");
        }

        #[cfg(target_os = "macos")]
        {
            // macOS 使用 avfoundation
            command
                .arg("-f")
                .arg("avfoundation")
                .arg("-framerate")
                .arg(params.frame_rate.to_string());
        }

        let mut audio_input = String::new();

        // 根据平台添加音频输入
        #[cfg(target_os = "windows")]
        {
            // 系统音频（扬声器输出）由 Rust 侧通过 WASAPI loopback 采集
            // （ffmpeg 的 dshow 无法直接捕获系统音频），采集完成后在片段
            // 结束时与视频片段合成，见 finalize_system_audio。

            // 添加麦克风音频输入
            if params.enable_microphone {
                let device_names = self.get_microphone_device_names();

                if device_names.len() > 0 {
                    // 统一采样率为 48000Hz，便于与系统音频（WASAPI loopback，48kHz）混音
                    command
                        .arg("-f")
                        .arg("dshow")
                        .arg("-ar")
                        .arg("48000")
                        .arg("-i")
                        .arg(format!(
                            "audio={}",
                            if device_names.contains(&params.microphone_device_name) {
                                params.microphone_device_name.clone()
                            } else {
                                device_names[0].clone()
                            }
                        ));
                    audio_input = format!("{}:a", 1);
                }
            }
        }

        #[cfg(target_os = "macos")]
        let monitor_list = MonitorList::all(true);
        #[cfg(target_os = "macos")]
        let mut target_monitor_index = 0;

        // macOS 音频输入处理
        #[cfg(target_os = "macos")]
        {
            let device_info_list = self.get_device_info_list();

            let audio_device = if params.enable_microphone {
                device_info_list.iter().find(|d| {
                    d.device_type == DeviceType::Audio
                        && Self::format_device_name(d) == params.microphone_device_name
                })
            } else {
                None
            };

            // 没有找到对应的显示器，回退到默认显示器
            for (monitor_index, monitor) in monitor_list.iter().enumerate() {
                use snow_shot_app_shared::ElementRect;

                if monitor.rect.overlaps(&ElementRect {
                    min_x: params.min_x,
                    min_y: params.min_y,
                    max_x: params.max_x,
                    max_y: params.max_y,
                }) {
                    target_monitor_index = monitor_index;
                    break;
                }
            }

            // 判断是否存在对应的显示器
            if !device_info_list.iter().any(|d| {
                d.device_type == DeviceType::Video
                    && d.name == format!("Capture screen {}", target_monitor_index)
            }) {
                target_monitor_index = 0;
                log::warn!(
                    "[video_record_service::start_segment] No corresponding display found for microphone device: {}",
                    params.microphone_device_name
                );
            }

            if let Some(audio_device) = audio_device {
                // 格式: -f avfoundation -i "0:设备索引"
                command
                    .arg("-i")
                    .arg(format!("{}:{}", target_monitor_index, audio_device.index));
                audio_input = format!("{}:a", audio_device.index);
            } else {
                command.arg("-i").arg(format!("{}", target_monitor_index));
            }
        }

        // 记录本片段是否包含麦克风音轨（audio_input 非空即已添加音轨）。
        // 用于合并系统音频时判断是否需要混音：ffmpeg -i 的流探测不可靠
        // （ffmpeg-sidecar 会过滤掉不带日志级别前缀的 Stream 行），因此
        // 直接用录制期信息驱动混音分支。
        #[cfg(target_os = "windows")]
        let segment_has_audio = !audio_input.is_empty();

        // 生成当前片段的文件名
        let segment_filename = format!(
            "{}_segment_{:03}.{}",
            params.output_file,
            self.segment_counter,
            params.format.extension()
        );

        // 确保输出文件的目录存在
        if let Some(parent_dir) = std::path::Path::new(&segment_filename).parent() {
            if let Err(e) = std::fs::create_dir_all(parent_dir) {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to create output directory: {}", e),
                ));
            }
        }

        let mut video_filter = String::new();
        let (target_width, target_height) = self.get_actual_video_size(
            width,
            height,
            params.video_max_width,
            params.video_max_height,
        );
        if target_width != width || target_height != height {
            video_filter = format!("scale={}:{}:flags=lanczos", target_width, target_height);
            println!(
                "Scaling video from {}x{} to {}x{}",
                width, height, target_width, target_height
            );
        }
        self.record_video_size = Some((target_width, target_height));

        // 根据格式设置不同的参数
        match params.format {
            VideoFormat::Mp4 => {
                command.arg("-c:v").arg(&params.encoder);

                // 根据编码器类型设置预设值
                // 注意: 检查顺序很重要,必须先检查特定编码器,最后才检查通用编码器
                if params.encoder.contains("amf") {
                    // AMD AMF编码器只支持特定的预设值
                    let amf_preset = match params.encoder_preset.as_str() {
                        "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" => "speed",
                        "medium" | "slow" => "balanced",
                        "slower" | "veryslow" | "placebo" => "quality",
                        // 如果已经是AMF支持的预设值，直接使用
                        "speed" | "balanced" | "quality" => &params.encoder_preset,
                        _ => "balanced", // 默认使用balanced
                    };
                    command.arg("-preset").arg(amf_preset);
                } else if params.encoder.starts_with("libaom") || params.encoder.starts_with("av1_") {
                    // AV1编码器使用global_quality参数 (详见 get_global_quality 函数注释)
                    let quality = get_global_quality(&params.encoder_preset);
                    command.arg("-global_quality").arg(quality.to_string());
                } else if params.encoder.starts_with("libvpx") {
                    // VP9编码器使用global_quality参数 (详见 get_global_quality 函数注释)
                    let quality = get_global_quality(&params.encoder_preset);
                    command.arg("-global_quality").arg(quality.to_string());
                } else if params.encoder.starts_with("mpeg4") {
                    // MPEG4编码器使用qscale参数
                    // qscale值 (1-31, **值越小质量越高**)
                    // 4: 高质量（压缩率低），慢速编码
                    // 5: 平衡质量
                    // 7: 低质量（压缩率高），快速编码
                    let quality = get_mpeg4_quality(&params.encoder_preset);
                    command.arg("-qscale").arg(quality.to_string());
                } else if params.encoder.starts_with("prores") {
                    // ProRes编码器使用profile参数 (详见 get_prores_quality 函数注释)
                    let quality = get_prores_quality(&params.encoder_preset);
                    command.arg("-profile").arg(quality.to_string());
                } else if params.encoder.starts_with("h264_qsv") {
                    // Intel H264_QSV编码器使用global_quality参数 (详见 get_global_quality 函数注释)
                    let quality = get_global_quality(&params.encoder_preset);
                    command.arg("-global_quality").arg(quality.to_string());
                } else if params.encoder.contains("nvenc") {
                    // NVIDIA NVENC编码器支持的预设值
                    let nvenc_preset = match params.encoder_preset.as_str() {
                        "ultrafast" => "p1",              // 最快
                        "superfast" | "veryfast" => "p2", // 更快
                        "faster" | "fast" => "p3",        // 快
                        "medium" => "p4",                 // 中等（默认）
                        "slow" => "p5",                   // 慢
                        "slower" => "p6",                 // 更慢
                        "veryslow" | "placebo" => "p7",   // 最慢
                        // 如果已经是NVENC支持的预设值，直接使用
                        "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7" | "hq" | "hp" | "ll"
                        | "llhq" | "llhp" | "default" | "bd" | "lossless" | "losslesshp" => {
                            &params.encoder_preset
                        }
                        _ => "p4", // 默认使用p4（中等）
                    };
                    command.arg("-preset").arg(nvenc_preset);
                } else {
                    // 其他编码器（如x264）使用原始预设值
                    command.arg("-preset").arg(&params.encoder_preset);
                }

                #[cfg(target_os = "windows")]
                {
                    if !video_filter.is_empty() {
                        command.arg("-vf").arg(&video_filter);
                    }

                    command.arg("-crf").arg("23").arg("-pix_fmt").arg("yuv420p"); // 添加像素格式，确保兼容性
                }

                #[cfg(target_os = "macos")]
                {
                    let target_monitor_rect =
                        if let Some(monitor) = monitor_list.iter().nth(target_monitor_index) {
                            monitor.rect
                        } else {
                            snow_shot_app_shared::ElementRect {
                                min_x: 0,
                                min_y: 0,
                                max_x: 0,
                                max_y: 0,
                            }
                        };

                    let crop_filter = format!(
                        "crop={}:{}:{}:{}",
                        width,
                        height,
                        (params.min_x - target_monitor_rect.min_x),
                        (params.min_y - target_monitor_rect.min_y)
                    );

                    // 组合 video_filter 和 crop_filter
                    let final_filter = if !video_filter.is_empty() {
                        format!("{},{}", crop_filter, video_filter)
                    } else {
                        crop_filter
                    };

                    command.arg("-vf").arg(final_filter);
                    command.arg("-crf").arg("23").arg("-pix_fmt").arg("uyvy422"); // 添加像素格式，确保兼容性
                }

                // 音频编码设置
                if !audio_input.is_empty() {
                    command.arg("-c:a").arg("aac").arg("-b:a").arg("128k");

                    // 音频处理，添加降噪
                    let filter_complex =
                        format!("[{}]anlmdn=s=10:p=0.001:r=0.005[aout]", audio_input);
                    command.arg("-filter_complex").arg(filter_complex);
                    command.arg("-map").arg("0:v").arg("-map").arg("[aout]");
                } else {
                    // 没有音频输入时，只映射视频
                    command.arg("-map").arg("0:v");
                }

                command.arg("-movflags").arg("+faststart"); // 优化MP4文件结构
            }
            VideoFormat::Gif => {
                // GIF格式不包含音频
                command
                    .arg("-vf")
                    .arg("fps=10,scale=-1:-1:flags=lanczos,palettegen=reserve_transparent=0")
                    .arg("-loop")
                    .arg("0");
            }
        }

        command.arg("-y");

        // 输出文件
        command.arg(&segment_filename);

        println!("FFmpeg segment command args: {:?}", command);

        // 提前启动系统音频采集（WASAPI loopback）：
        // 必须在 ffmpeg spawn 之前启动，否则视频开头一段会没有音频（音画不同步）。
        #[cfg(target_os = "windows")]
        let system_audio = if params.enable_system_audio {
            let wav_path = format!("{}_sys_audio.wav", segment_filename);
            match SystemAudioCapture::start(PathBuf::from(&wav_path)) {
                Ok(capture) => Some((capture, wav_path)),
                Err(e) => {
                    log::error!(
                        "[video_record_service] Failed to start system audio capture: {}",
                        e
                    );
                    None
                }
            }
        } else {
            None
        };

        // 记录视频录制起点（ffmpeg spawn 时刻），用于音频时间戳对齐
        #[cfg(target_os = "windows")]
        let video_start = Instant::now();

        // 启动ffmpeg进程
        match command.spawn() {
            Ok(mut child) => {
                for event in child.iter().unwrap() {
                    if params.format == VideoFormat::Mp4 {
                        match event {
                            FfmpegEvent::Progress(_) => {
                                self.child = Some(child);
                                self.state = VideoRecordState::Recording;
                                self.segments.push(segment_filename.clone());
                                self.segment_counter += 1;

                                // 保存系统音频采集状态（采集已在 spawn 前启动）
                                #[cfg(target_os = "windows")]
                                if let Some((capture, wav_path)) = system_audio {
                                    self.system_audio_capture = Some(capture);
                                    self.current_segment_audio_file =
                                        Some(PathBuf::from(&wav_path));
                                    self.current_segment_video_start = Some(video_start);
                                    self.current_segment_has_audio = Some(segment_has_audio);
                                    println!(
                                        "[video_record_service] System audio capture running for segment: {} (segment_has_audio={})",
                                        wav_path, segment_has_audio
                                    );
                                }

                                return Ok(());
                            }
                            _ => {}
                        }
                    }
                }

                // 启动失败（未等到 Progress 事件）：清理系统音频采集
                #[cfg(target_os = "windows")]
                if let Some((mut capture, wav_path)) = system_audio {
                    capture.stop();
                    let _ = std::fs::remove_file(&wav_path);
                }

                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    "Failed to start recording segment",
                ))
            }
            Err(e) => {
                // ffmpeg 启动失败：清理系统音频采集
                #[cfg(target_os = "windows")]
                if let Some((mut capture, wav_path)) = system_audio {
                    capture.stop();
                    let _ = std::fs::remove_file(&wav_path);
                }

                self.state = VideoRecordState::Idle;
                println!("FFmpeg start error: {}", e);
                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to start recording segment: {}", e),
                ))
            }
        }
    }

    #[cfg(target_os = "macos")]
    pub fn get_device_info_list(&self) -> Vec<DeviceInfo> {
        let mut device_info_list = Vec::new();

        let mut command = self.get_ffmpeg_command();
        command
            .arg("-list_devices")
            .arg("true")
            .arg("-f")
            .arg("avfoundation")
            .arg("-i")
            .arg("dummy");

        log::info!("FFmpeg get_device_info_list command (macOS): {:?}", command);

        let mut child = match command.spawn() {
            Ok(child) => child,
            Err(e) => {
                log::error!("[get_device_info_list] Failed to spawn ffmpeg: {}", e);
                return device_info_list;
            }
        };

        let output_iter = match child.iter() {
            Ok(output) => output,
            Err(e) => {
                log::error!("[get_device_info_list] Failed to iter ffmpeg: {}", e);
                return device_info_list;
            }
        };

        // macOS avfoundation 格式的正则表达式
        // 格式: [AVFoundation indev @ 0x...] [info] [0] 设备名称
        let device_regex = match Regex::new(r#"\[AVFoundation indev @ [^\]]+\]\s+\[info\]\s+\[(\d+)\]\s+(.+)"#)
        {
            Ok(regex) => regex,
            Err(e) => {
                log::error!("[get_device_info_list] Failed to create regex: {}", e);
                return device_info_list;
            }
        };

        // 检测当前正在解析的设备类型
        let mut current_device_type = DeviceType::Video;

        for line in output_iter {
            match line {
                FfmpegEvent::Log(_, line) => {
                    // 检查是否遇到了视频设备列表的标记
                    if line.contains("AVFoundation video devices") {
                        current_device_type = DeviceType::Video;
                        log::info!(
                            "[get_device_info_list] Found video devices marker, starting to parse devices"
                        );
                        continue;
                    }

                    // 检查是否遇到了音频设备列表的标记
                    if line.contains("AVFoundation audio devices") {
                        current_device_type = DeviceType::Audio;
                        log::info!(
                            "[get_device_info_list] Found audio devices marker, starting to parse devices"
                        );
                        continue;
                    }

                    if let Some(captures) = device_regex.captures(&line) {
                        let device_index = captures.get(1).unwrap().as_str().to_string();
                        let device_name = captures.get(2).unwrap().as_str().to_string();
                        device_info_list.push(DeviceInfo {
                            name: device_name,
                            index: device_index.parse::<usize>().unwrap(),
                            device_type: current_device_type,
                        });
                    }
                }
                _ => {}
            }
        }

        let _ = child.wait();

        log::info!(
            "[get_device_names] Total found devices: {}",
            device_info_list.len()
        );
        device_info_list
    }

    #[cfg(target_os = "macos")]
    fn format_device_name(device_info: &DeviceInfo) -> String {
        format!("[{}] {}", device_info.index, device_info.name)
    }

    pub fn get_microphone_device_names(&self) -> Vec<String> {
        let mut device_names = Vec::new();

        #[cfg(target_os = "windows")]
        {
            let mut command = self.get_ffmpeg_command();
            command
                .arg("-list_devices")
                .arg("true")
                .arg("-f")
                .arg("dshow")
                .arg("-i")
                .arg("dummy");

            let mut child = match command.spawn() {
                Ok(child) => child,
                Err(e) => {
                    println!(
                        "[get_microphone_device_names] Failed to spawn ffmpeg: {}",
                        e
                    );
                    return device_names;
                }
            };

            let output_iter = match child.iter() {
                Ok(output) => output,
                Err(e) => {
                    println!("[get_microphone_device_names] Failed to iter ffmpeg: {}", e);
                    return device_names;
                }
            };

            // Windows dshow 格式的正则表达式
            // 格式: [dshow @ address] [info] "设备名称" (audio)
            let device_regex = match Regex::new(r#"\[info\]\s+"([^"]+)"\s+\(audio\)"#) {
                Ok(regex) => regex,
                Err(e) => {
                    println!(
                        "[get_microphone_device_names] Failed to create regex: {}",
                        e
                    );
                    return device_names;
                }
            };

            for line in output_iter {
                match line {
                    FfmpegEvent::Log(_, line) => {
                        // 使用正则表达式解析音频设备
                        if let Some(captures) = device_regex.captures(&line) {
                            if let Some(device_name) = captures.get(1) {
                                let name = device_name.as_str().to_string();
                                device_names.push(name.clone());
                                println!(
                                    "[get_microphone_device_names] Found audio device: {}",
                                    name
                                );
                            }
                        }
                    }
                    _ => {}
                }
            }

            let _ = child.wait();
        }

        #[cfg(target_os = "macos")]
        {
            let device_info_list = self.get_device_info_list();
            for device_info in device_info_list {
                if device_info.device_type == DeviceType::Audio {
                    device_names.push(Self::format_device_name(&device_info));
                }
            }
        }

        println!(
            "[get_microphone_device_names] Total found devices: {}",
            device_names.len()
        );
        device_names
    }

    /// 根据设备名称获取设备索引
    /// 返回 Option<u32>，如果找不到设备则返回 None
    pub fn get_microphone_device_index(&self, device_name: &str) -> Option<u32> {
        // 使用正则表达式从设备名称中提取索引
        // 设备名称格式: [0] 设备名称
        if let Ok(device_index_regex) = Regex::new(r#"\[(\d+)\]\s+(.+)"#) {
            if let Some(captures) = device_index_regex.captures(device_name) {
                if let Some(index_match) = captures.get(1) {
                    if let Ok(device_index) = index_match.as_str().parse::<u32>() {
                        println!(
                            "[get_microphone_device_index] Found device index {} for device: {}",
                            device_index, device_name
                        );
                        return Some(device_index);
                    }
                }
            }
        }

        println!(
            "[get_microphone_device_index] Failed to extract index from device name: {}",
            device_name
        );
        None
    }

    pub fn kill(&mut self) -> Result<()> {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
        }

        // 停止系统音频采集并删除未完成的音频文件（视频已被强制终止，不进行合成）
        #[cfg(target_os = "windows")]
        {
            if let Some(mut capture) = self.system_audio_capture.take() {
                capture.stop();
            }

            if let Some(wav_path) = self.current_segment_audio_file.take() {
                let _ = std::fs::remove_file(&wav_path);
            }
        }

        self.cleanup();
        Ok(())
    }

    fn get_final_filename(&self) -> String {
        let params = self.recording_params.as_ref().unwrap();
        format!("{}.{}", params.output_file, params.format.extension())
    }

    /// 结束当前片段的系统音频采集，并将采集到的音频合成进当前视频片段
    ///
    /// 系统音频在 ffmpeg spawn 之前就提前启动采集，这里根据音频采集流
    /// 实际开始时刻与视频录制起点的差值，用 `-itsoffset` 补偿音频时间戳，
    /// 保证音画同步。
    #[cfg(target_os = "windows")]
    fn finalize_system_audio(&mut self) -> Result<()> {
        let audio_offset_secs = if let Some(mut capture) = self.system_audio_capture.take() {
            capture.stop();

            // 音频相对视频起点的提前量（秒）：音频提前采集了多少，就给音频时间戳加多少
            let offset = if let Some(video_start) = self.current_segment_video_start.take() {
                video_start
                    .saturating_duration_since(capture.started_at())
                    .as_secs_f64()
            } else {
                0.0
            };

            Some(offset)
        } else {
            None
        };

        if let Some(wav_path) = self.current_segment_audio_file.take() {
            if wav_path.exists() && has_wav_audio_data(&wav_path) {
                if let Some(segment) = self.segments.last().cloned() {
                    // 该片段是否含麦克风音轨：优先用录制期记录（可靠），
                    // 无记录时回退为 false（仅系统音频）
                    let has_audio = self.current_segment_has_audio.take().unwrap_or(false);

                    if let Err(e) = self.merge_system_audio_into_segment(
                        &segment,
                        &wav_path,
                        audio_offset_secs.unwrap_or(0.0),
                        has_audio,
                    ) {
                        log::error!(
                            "[video_record_service] Failed to merge system audio into segment: {}",
                            e
                        );
                    }
                }
            }

            let _ = std::fs::remove_file(&wav_path);
        }

        Ok(())
    }

    /// 将系统音频（WAV）合成进指定视频片段
    ///
    /// - `has_audio_stream`：片段内是否已有麦克风音轨（录制期记录）。
    ///   有音轨时与系统音频混音（amix），无音轨时直接添加系统音频流。
    /// - `audio_offset_secs`：音频相对视频起点的提前量（秒）。无音轨时用
    ///   `-itsoffset` 丢弃提前部分；有音轨时在 filter 内用 `atrim` 丢弃。
    #[cfg(target_os = "windows")]
    fn merge_system_audio_into_segment(
        &mut self,
        segment_filename: &str,
        wav_path: &Path,
        audio_offset_secs: f64,
        has_audio_stream: bool,
    ) -> Result<()> {
        let tmp_filename = format!("{}_tmp.mp4", segment_filename);

        let mut command = self.get_ffmpeg_command();
        command
            .arg("-y")
            .arg("-i")
            .arg(segment_filename);

        // 无麦克风音轨（直接 map WAV）时，用 -itsoffset 丢弃提前采集的部分并对齐到视频起点
        if !has_audio_stream && audio_offset_secs > 0.0 {
            command
                .arg("-itsoffset")
                .arg(format!("-{:.6}", audio_offset_secs));
        }

        command.arg("-i").arg(wav_path);

        if has_audio_stream {
            // 片段内已有麦克风音轨，与系统音频混音（normalize=0 保持原始音量）。
            // 两路输入都统一为 48kHz / s16 / 立体声，避免采样率或声道数不一致
            // 导致 amix 失败（只混出一路甚至整体失败）。
            // 系统音频提前采集的部分在混音前用 atrim 丢弃，保证与画面起点对齐。
            let filter_complex = if audio_offset_secs > 0.0 {
                format!(
                    "[1:a]aformat=sample_fmts=s16:channel_layouts=stereo,aresample=48000,atrim=start={:.6},asetpts=PTS-STARTPTS[a1];[0:a]aformat=sample_fmts=s16:channel_layouts=stereo,aresample=48000[a0];[a0][a1]amix=inputs=2:normalize=0:dropout_transition=0[aout]",
                    audio_offset_secs
                )
            } else {
                "[0:a]aformat=sample_fmts=s16:channel_layouts=stereo,aresample=48000[a0];[1:a]aformat=sample_fmts=s16:channel_layouts=stereo,aresample=48000[a1];[a0][a1]amix=inputs=2:normalize=0:dropout_transition=0[aout]"
                    .to_string()
            };

            command
                .arg("-filter_complex")
                .arg(filter_complex)
                .arg("-map")
                .arg("0:v")
                .arg("-map")
                .arg("[aout]");
        } else {
            command
                .arg("-map")
                .arg("0:v")
                .arg("-map")
                .arg("1:a");
        }

        command
            .arg("-c:v")
            .arg("copy")
            .arg("-c:a")
            .arg("aac")
            .arg("-b:a")
            .arg("128k")
            .arg("-ar")
            .arg("48000")
            .arg("-movflags")
            .arg("+faststart")
            .arg(&tmp_filename);

        println!(
            "[video_record_service] Merging system audio into segment (has_audio_stream={}): {:?}",
            has_audio_stream, command
        );

        match command.spawn() {
            Ok(mut child) => {
                // 读取 ffmpeg 输出日志，混音失败时错误信息可见
                if let Ok(iter) = child.iter() {
                    for event in iter {
                        if let FfmpegEvent::Log(_, line) = event {
                            println!("[video_record_service][merge] {}", line);
                        }
                    }
                }

                if std::path::Path::new(&tmp_filename).exists() {
                    std::fs::remove_file(segment_filename)?;
                    std::fs::rename(&tmp_filename, segment_filename)?;
                    println!(
                        "[video_record_service] Merged system audio into {}",
                        segment_filename
                    );
                    Ok(())
                } else {
                    Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!(
                            "Failed to merge system audio into segment: {} output not found",
                            segment_filename
                        ),
                    ))
                }
            }
            Err(e) => Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to merge system audio into segment: {}", e),
            )),
        }
    }

    pub fn stop(
        &mut self,
        convert_to_gif: bool,
        gif_format: &str,
        gif_frame_rate: u32,
        gif_max_width: i32,
        gif_max_height: i32,
    ) -> Result<Option<String>> {
        if self.state != VideoRecordState::Recording && self.state != VideoRecordState::Paused {
            return Ok(None);
        }

        println!("[FFmpeg] Stopping and merging segments");

        // 停止当前录制
        if let Some(mut child) = self.child.take() {
            let _ = child.quit();
            let _ = child.wait();
        }

        // 结束系统音频采集并合成进当前片段
        #[cfg(target_os = "windows")]
        self.finalize_system_audio()?;

        // 如果只有一个片段，直接重命名
        let mut final_filename = self.get_final_filename();
        if self.segments.len() == 1 {
            if let Err(e) = std::fs::rename(&self.segments[0], &final_filename) {
                println!("Failed to rename single segment: {}", e);
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to rename segment: {}", e),
                ));
            }
        } else if self.segments.len() > 1 {
            // 多个片段需要合并
            self.merge_segments(final_filename.clone())?;
        }

        // 如果需要转换为GIF格式
        if convert_to_gif && self.recording_params.as_ref().unwrap().format == VideoFormat::Mp4 {
            final_filename = self.convert_to_gif(
                gif_format,
                &final_filename,
                gif_frame_rate,
                gif_max_width,
                gif_max_height,
            )?;
        }

        self.cleanup();
        Ok(Some(final_filename))
    }

    fn merge_segments(&mut self, final_filename: String) -> Result<()> {
        let params = self.recording_params.as_ref().unwrap();

        // 创建临时的文件列表
        let list_filename = format!("{}_segments.txt", params.output_file);
        let mut list_content = String::new();

        for segment in &self.segments {
            list_content.push_str(&format!("file '{}'\n", segment));
        }

        if let Err(e) = std::fs::write(&list_filename, list_content) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to create segment list: {}", e),
            ));
        }

        // 使用ffmpeg合并片段
        let mut command = self.get_ffmpeg_command();
        command
            .arg("-f")
            .arg("concat")
            .arg("-safe")
            .arg("0")
            .arg("-i")
            .arg(&list_filename)
            .arg("-c")
            .arg("copy")
            .arg("-y")
            .arg(&final_filename);

        println!("Merging segments with command: {:?}", command);

        match command.spawn() {
            Ok(mut child) => {
                let _ = child.wait();

                // 删除临时文件列表
                let _ = std::fs::remove_file(&list_filename);

                // 删除所有片段文件
                for segment in &self.segments {
                    if let Err(e) = std::fs::remove_file(segment) {
                        println!("Warning: Failed to delete segment file {}: {}", segment, e);
                    }
                }

                println!("Segments merged successfully");
                Ok(())
            }
            Err(e) => {
                println!("Failed to merge segments: {}", e);
                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to merge segments: {}", e),
                ))
            }
        }
    }

    fn convert_to_gif(
        &self,
        format: &str,
        mp4_filename: &str,
        gif_frame_rate: u32,
        gif_max_width: i32,
        gif_max_height: i32,
    ) -> Result<String> {
        let params = self.recording_params.as_ref().unwrap();

        // 生成输出文件名
        let output_filename = if format == "apng" {
            format!("{}.png", params.output_file)
        } else if format == "webp" {
            format!("{}.webp", params.output_file)
        } else {
            format!("{}.gif", params.output_file)
        };

        let format_name = if format == "apng" {
            "APNG"
        } else if format == "webp" {
            "WEBP"
        } else {
            "GIF"
        };
        println!(
            "[FFmpeg] Converting MP4 to {}: {} -> {}",
            format_name, mp4_filename, output_filename
        );

        // 确保输出文件的目录存在
        if let Some(parent_dir) = std::path::Path::new(&output_filename).parent() {
            if let Err(e) = std::fs::create_dir_all(parent_dir) {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to create output directory: {}", e),
                ));
            }
        }

        let video_width = self.record_video_size.as_ref().unwrap().0;
        let video_height = self.record_video_size.as_ref().unwrap().1;

        let (target_width, target_height) =
            self.get_actual_video_size(video_width, video_height, gif_max_width, gif_max_height);

        let scale_filter = if target_width != video_width || target_height != video_height {
            format!("scale={}:{}:flags=lanczos", target_width, target_height)
        } else {
            format!("scale=-1:-1:flags=lanczos")
        };

        // 构建FFmpeg命令进行MP4到GIF/APNG的转换
        let mut command = self.get_ffmpeg_command();

        if format == "apng" {
            // APNG格式转换 - 平衡版本
            // APNG 是无损格式，通过压缩级别和预测模式优化
            // 优化策略（平衡模式）：
            // 1. compression_level=6：中等偏高的压缩级别，速度和大小平衡
            // 2. pred=mixed：混合预测模式，对大多数内容压缩效果最好
            command
                .arg("-i")
                .arg(mp4_filename)
                .arg("-vf")
                .arg(format!("fps={},{}", gif_frame_rate, scale_filter))
                .arg("-f")
                .arg("apng")
                .arg("-plays")
                .arg("0") // 无限循环
                .arg("-compression_level")
                .arg("6")
                .arg("-pred")
                .arg("mixed")
                .arg("-y")
                .arg(&output_filename);
        } else if format == "webp" {
            // WEBP格式转换 - 平衡版本，适合日常使用
            // WEBP 支持有损和无损压缩，这里使用有损模式获得更好的压缩率
            // 优化策略（平衡模式）：
            // 1. lossless=0：使用有损压缩模式（文件更小）
            // 2. quality=85：质量设为85（0-100），保证良好视觉效果
            // 3. compression_level=4：中等压缩级别，速度和大小平衡
            // 4. method=4：中等压缩方法，编码速度较快
            command
                .arg("-i")
                .arg(mp4_filename)
                .arg("-vf")
                .arg(format!("fps={},{}", gif_frame_rate, scale_filter))
                .arg("-f")
                .arg("webp")
                .arg("-lossless")
                .arg("0")
                .arg("-quality")
                .arg("85")
                .arg("-compression_level")
                .arg("4")
                .arg("-method")
                .arg("4")
                .arg("-loop")
                .arg("0") // 无限循环
                .arg("-y")
                .arg(&output_filename);
        } else {
            // GIF格式转换 - 平衡版本，适合日常使用
            // 优化策略（平衡模式）：
            // 1. max_colors=192：保留较多颜色，保证视觉质量
            // 2. 使用 diff 统计模式以更好地处理动画
            // 3. 使用 floyd_steinberg 抖动算法提高视觉质量
            // 4. diff_mode=rectangle 优化动画压缩
            command
                .arg("-i")
                .arg(mp4_filename)
                .arg("-vf")
                .arg(format!(
                    "fps={},{},split[s0][s1];[s0]palettegen=max_colors=192:stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg:diff_mode=rectangle",
                    gif_frame_rate, scale_filter,
                ))
                .arg("-loop")
                .arg("0")
                .arg("-y")
                .arg(&output_filename);
        }

        println!("FFmpeg {} conversion command: {:?}", format_name, command);

        match command.spawn() {
            Ok(mut child) => {
                let _ = child.wait();

                // 检查输出文件是否成功生成
                if std::path::Path::new(&output_filename).exists() {
                    println!(
                        "{} conversion completed successfully: {}",
                        format_name, output_filename
                    );

                    // 删除原始MP4文件
                    if let Err(e) = std::fs::remove_file(mp4_filename) {
                        println!(
                            "Warning: Failed to delete original MP4 file {}: {}",
                            mp4_filename, e
                        );
                    }

                    Ok(output_filename)
                } else {
                    Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("{} conversion failed - output file not found", format_name),
                    ))
                }
            }
            Err(e) => {
                println!("Failed to convert MP4 to {}: {}", format_name, e);
                Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to convert MP4 to {}: {}", format_name, e),
                ))
            }
        }
    }

    fn cleanup(&mut self) {
        self.state = VideoRecordState::Idle;
        self.segments.clear();
        self.segment_counter = 0;
        self.recording_params = None;
        #[cfg(target_os = "windows")]
        {
            self.system_audio_capture = None;
            self.current_segment_audio_file = None;
            self.current_segment_video_start = None;
            self.current_segment_has_audio = None;
        }
    }

    pub fn pause(&mut self) -> Result<()> {
        if self.state != VideoRecordState::Recording {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "No recording in progress",
            ));
        }

        println!("[FFmpeg] Pausing recording - stopping current segment");

        // 停止当前片段的录制
        if let Some(mut child) = self.child.take() {
            let _ = child.quit();
            let _ = child.wait();
        }

        // 结束系统音频采集并合成进当前片段
        #[cfg(target_os = "windows")]
        self.finalize_system_audio()?;

        self.state = VideoRecordState::Paused;
        Ok(())
    }

    pub fn resume(&mut self) -> Result<()> {
        if self.state != VideoRecordState::Paused {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording is not paused",
            ));
        }

        println!("[FFmpeg] Resuming recording - starting new segment");

        // 开始新片段的录制
        self.start_segment()
    }
}

/// 检查 WAV 文件是否包含有效音频数据（data chunk 长度 > 0）
#[cfg(target_os = "windows")]
fn has_wav_audio_data(path: &Path) -> bool {
    use std::io::{Read, Seek as _};

    let Ok(mut file) = std::fs::File::open(path) else {
        return false;
    };

    // 跳到 data chunk 长度字段（偏移 40），读取并判断
    if file.seek(std::io::SeekFrom::Start(40)).is_err() {
        return false;
    }

    let mut buf = [0u8; 4];
    if file.read_exact(&mut buf).is_err() {
        return false;
    }

    u32::from_le_bytes(buf) > 0
}
