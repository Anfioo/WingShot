pub fn get_focused_window() -> () {
    log::warn!("[os::utils::linux::get_focused_window] not implemented");

    ()
}

pub fn switch_always_on_top() -> () {
    log::warn!("[os::utils::linux::switch_always_on_top] not implemented");

    ()
}

pub fn set_draw_window_style(window: tauri::Window) {
    log::warn!("[os::utils::linux::set_draw_window_style] not implemented");

    ()
}

pub fn create_admin_auto_start_task() -> Result<(), String> {
    Ok(())
}

pub fn delete_admin_auto_start_task() -> Result<(), String> {
    Ok(())
}

pub fn restart_with_admin() -> Result<(), String> {
    Ok(())
}

/// 重启应用程序（不使用管理员权限）
pub fn restart() -> Result<(), String> {
    use std::env;
    use std::process::Command;

    // 获取当前可执行文件的路径
    let current_exe = match env::current_exe() {
        Ok(current_exe) => current_exe,
        Err(e) => {
            return Err(format!("[restart] env::current_exe failed: {:?}", e));
        }
    };
    let exe_path = current_exe.to_string_lossy();

    // 使用 sh -c 延迟启动新进程，确保旧进程有足够时间退出并释放单实例锁
    // sleep 1 大约延迟 1 秒，& 使其在后台运行
    let cmd = format!("sleep 1 && \"{}\" &", exe_path);

    match Command::new("sh").arg("-c").arg(&cmd).spawn() {
        Ok(_) => {
            // 退出当前进程，让单实例锁释放
            std::process::exit(0);
        }
        Err(e) => {
            return Err(format!("[restart] Failed to spawn restart process: {:?}", e));
        }
    }
}

pub fn is_admin() -> bool {
    false
}
