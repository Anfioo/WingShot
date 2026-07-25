use std::path::{Path, PathBuf};

use crate::plugin::{Plugin, PluginStatus};
use dashmap::DashMap;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::sync::RwLock;

pub struct PluginService {
    version: RwLock<String>,
    plugin_install_dir: RwLock<PathBuf>,
    plugin_download_dir: RwLock<PathBuf>,
    plugin_download_service_url: RwLock<Url>,
    plugins: DashMap<String, Arc<RwLock<Plugin>>>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub struct PluginStatusResult {
    name: String,
    status: PluginStatus,
}

impl PluginService {
    pub fn new() -> Self {
        Self {
            version: RwLock::new("".to_string()),
            plugin_install_dir: RwLock::new(PathBuf::new()),
            plugin_download_dir: RwLock::new(PathBuf::new()),
            plugin_download_service_url: RwLock::new(
                Url::parse("https://snowshot.top/plugins").unwrap(),
            ),
            plugins: DashMap::new(),
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn init(
        &self,
        version: String,
        plugin_install_dir: &Path,
        plugin_download_dir: &Path,
        plugin_download_service_url: Url,
        app_handle: AppHandle,
    ) {
        let mut version_guard = self.version.write().await;
        *version_guard = version;
        let mut plugin_install_dir_guard = self.plugin_install_dir.write().await;
        *plugin_install_dir_guard = plugin_install_dir.to_path_buf();
        let mut plugin_download_dir_guard = self.plugin_download_dir.write().await;
        *plugin_download_dir_guard = plugin_download_dir.to_path_buf();
        let mut plugin_download_service_url_guard = self.plugin_download_service_url.write().await;
        *plugin_download_service_url_guard = plugin_download_service_url;
        let mut app_handle_guard = self.app_handle.write().await;
        *app_handle_guard = Some(app_handle);
    }

    async fn clean_data_dir(&self, dir: &Path) -> Result<(), String> {
        if !dir.exists() {
            return Ok(());
        }

        if !dir.is_dir() {
            match tokio::fs::remove_file(dir).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[PluginService::clean_data_dir] Failed to remove plugin install directory: {}",
                        e
                    ));
                }
            }
            return Ok(());
        }

        let mut dir = match tokio::fs::read_dir(dir).await {
            Ok(dir) => dir,
            Err(e) => {
                return Err(format!(
                    "[PluginService::clean_data_dir] Failed to read plugin install directory: {}",
                    e
                ));
            }
        };

        while let Some(entry) = dir.next_entry().await.map_err(|e| {
            format!(
                "[PluginService::clean_data_dir] Failed to read directory entry: {}",
                e
            )
        })? {
            // 保留当前版本的目录
            let version_guard = self.version.read().await;
            if entry.path().is_dir() && entry.path().file_name().unwrap() == version_guard.as_str()
            {
                continue;
            }

            let path = entry.path();
            match tokio::fs::remove_dir_all(&path).await {
                Ok(_) => (),
                Err(e) => {
                    return Err(format!(
                        "[PluginService::clean_data_dir] Failed to remove plugin install directory: {}",
                        e
                    ));
                }
            }
        }
        Ok(())
    }

    /**
     * 清除下载目录
     */
    pub async fn clean_download_dir(&self) -> Result<(), String> {
        self.clean_data_dir(&self.plugin_download_dir.read().await)
            .await
    }

    /**
     * 清除插件目录安装的旧版本
     */
    pub async fn clean_invalid_version(&self) -> Result<(), String> {
        self.clean_data_dir(&self.plugin_install_dir.read().await)
            .await
    }

    async fn create_plugin(&self, name: &str, file_list: Vec<PathBuf>) -> Plugin {
        Plugin::new(
            &self.plugin_install_dir.read().await.as_path(),
            &self.plugin_download_dir.read().await.as_path(),
            name.to_string(),
            file_list,
            self.version.read().await.clone(),
            self.plugin_download_service_url.read().await.clone(),
            self.app_handle.clone(),
        )
    }

    pub async fn register_plugin(&self, name: String, file_list: Vec<PathBuf>) -> &Self {
        let plugin = self.create_plugin(&name, file_list).await;

        let plugin = Arc::new(RwLock::new(plugin));
        self.plugins.insert(name, plugin.clone());

        plugin.read().await.refresh_status().await;

        self
    }

    pub async fn install_plugin(&self, name: String, force: bool) -> Result<(), String> {
        let plugin = match self.plugins.get(&name) {
            Some(plugin) => plugin,
            None => {
                return Err(format!(
                    "[PluginService::install_plugin] Plugin not found: {}",
                    name
                ));
            }
        };

        let plugin_guard = plugin.read().await;
        plugin_guard.install(force).await
    }

    pub async fn uninstall_plugin(&self, name: String) -> Result<(), String> {
        let plugin = match self.plugins.get(&name) {
            Some(plugin) => plugin,
            None => {
                return Err(format!(
                    "[PluginService::uninstall_plugin] Plugin not found: {}",
                    name
                ));
            }
        };

        let plugin_guard = plugin.read().await;
        plugin_guard.uninstall().await
    }

    pub async fn get_plugins_status(&self) -> Result<Vec<PluginStatusResult>, String> {
        let mut plugins_status = Vec::new();
        for plugin in self.plugins.iter() {
            let plugin_guard = plugin.read().await;
            plugins_status.push(PluginStatusResult {
                name: plugin_guard.get_name(),
                status: plugin_guard.get_status().await,
            });
        }
        Ok(plugins_status)
    }

    pub async fn get_plugin_dir_path(&self, name: String) -> Result<PathBuf, String> {
        let plugin = match self.plugins.get(&name) {
            Some(plugin) => plugin,
            None => {
                return Err(format!(
                    "[PluginService::get_plugin_dir_path] Plugin not found: {}",
                    name
                ));
            }
        };

        let plugin_guard = plugin.read().await;
        Ok(plugin_guard.get_plugin_dir())
    }
}
