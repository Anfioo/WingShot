fn main() {
    // 获取git commit SHA
    let commit_sha = std::process::Command::new("git")
        .args(&["rev-parse", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| String::from("unknown"));

    println!("cargo:rustc-env=COMMIT_SHA={}", commit_sha);

    tauri_build::build();
}
