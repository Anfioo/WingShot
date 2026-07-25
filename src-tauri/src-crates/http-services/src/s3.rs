use anyhow::{Context, Result};
use log::{debug, error, info};
use s3::creds::Credentials;
use s3::{Bucket, Region};
use serde::{Deserialize, Serialize};

/// S3 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct S3Config {
    /// S3 端点 URL (例如: https://s3.amazonaws.com 或自定义对象存储服务)
    pub endpoint: String,
    /// 区域 (例如: us-east-1)
    pub region: String,
    /// Access Key ID
    pub access_key_id: String,
    /// Secret Access Key
    pub secret_access_key: String,
    /// 存储桶名称
    pub bucket: String,
    /// 路径前缀（可选，例如: images/）
    pub path_prefix: Option<String>,
    /// 是否使用路径风格 (path-style) 访问
    /// true: https://endpoint/bucket/key
    /// false: https://bucket.endpoint/key
    pub force_path_style: bool,
}

impl Default for S3Config {
    fn default() -> Self {
        Self {
            endpoint: "https://s3.amazonaws.com".to_string(),
            region: "us-east-1".to_string(),
            access_key_id: String::new(),
            secret_access_key: String::new(),
            bucket: String::new(),
            path_prefix: None,
            force_path_style: false,
        }
    }
}

/// S3 上传服务
pub struct S3Service {
    bucket: Box<Bucket>,
    config: S3Config,
}

impl S3Service {
    /// 创建新的 S3 服务实例
    pub async fn new(config: S3Config) -> Result<Self> {
        info!(
            "Init S3 client, endpoint: {}, region: {}, bucket: {}",
            config.endpoint, config.region, config.bucket
        );

        // 创建凭证
        let credentials = Credentials::new(
            Some(&config.access_key_id),
            Some(&config.secret_access_key),
            None,
            None,
            None,
        )
        .context("Create S3 credentials failed")?;

        // 创建区域配置
        let region = if config.endpoint.is_empty() || config.endpoint == "https://s3.amazonaws.com"
        {
            // 标准 AWS S3 - 使用默认的 US East 1 或根据配置选择
            match config.region.as_str() {
                "us-east-1" => Region::UsEast1,
                "us-east-2" => Region::UsEast2,
                "us-west-1" => Region::UsWest1,
                "us-west-2" => Region::UsWest2,
                "eu-west-1" => Region::EuWest1,
                "eu-west-2" => Region::EuWest2,
                "eu-west-3" => Region::EuWest3,
                "eu-central-1" => Region::EuCentral1,
                "ap-south-1" => Region::ApSouth1,
                "ap-southeast-1" => Region::ApSoutheast1,
                "ap-southeast-2" => Region::ApSoutheast2,
                "ap-northeast-1" => Region::ApNortheast1,
                "ap-northeast-2" => Region::ApNortheast2,
                "ap-northeast-3" => Region::ApNortheast3,
                "sa-east-1" => Region::SaEast1,
                "cn-north-1" => Region::CnNorth1,
                "cn-northwest-1" => Region::CnNorthwest1,
                "ca-central-1" => Region::CaCentral1,
                _ => {
                    // 不支持的区域，使用自定义配置
                    Region::Custom {
                        region: config.region.clone(),
                        endpoint: "https://s3.amazonaws.com".to_string(),
                    }
                }
            }
        } else {
            // 自定义端点
            Region::Custom {
                region: config.region.clone(),
                endpoint: config.endpoint.clone(),
            }
        };

        // 创建存储桶实例
        let mut bucket = Bucket::new(&config.bucket, region, credentials)?;

        // 设置路径风格
        if config.force_path_style {
            bucket = bucket.with_path_style();
        }

        info!("S3 client initialized successfully");

        Ok(Self {
            bucket,
            config: config.clone(),
        })
    }

    /// 上传字节数据到 S3
    ///
    /// # 参数
    /// * `data` - 字节数据
    /// * `object_key` - S3 对象键名
    /// * `content_type` - MIME 类型（可选）
    ///
    /// # 返回
    /// 上传成功后的 URL
    pub async fn upload_bytes(
        &self,
        data: &[u8],
        object_key: String,
        content_type: Option<String>,
    ) -> Result<String> {
        // 添加路径前缀
        let full_key = if let Some(prefix) = &self.config.path_prefix {
            format!("{}{}", prefix, object_key)
        } else {
            object_key
        };

        info!(
            "Start uploading data to: {}/{}",
            self.config.bucket, full_key
        );

        // 设置 Content-Type
        let ct = content_type.unwrap_or_else(|| "application/octet-stream".to_string());
        debug!("Content-Type: {}", ct);

        // 上传到 S3
        let response = self
            .bucket
            .put_object_with_content_type(&full_key, &data, &ct)
            .await
            .context("Upload data to S3 failed")?;

        if response.status_code() != 200 {
            error!(
                "Upload failed, HTTP status code: {}",
                response.status_code()
            );
            anyhow::bail!(
                "Upload failed, HTTP status code: {}",
                response.status_code()
            );
        }

        // 构建访问 URL
        let url = self.build_url(&full_key);
        info!("Data uploaded successfully: {}", url);

        Ok(url)
    }

    /// 获取对象的预签名 URL
    ///
    /// # 参数
    /// * `object_key` - S3 对象键名
    /// * `expiry_secs` - 过期时间（秒）
    ///
    /// # 返回
    /// 预签名 URL
    pub async fn get_presigned_url(&self, object_key: &str, expiry_secs: u32) -> Result<String> {
        // 添加路径前缀
        let full_key = if let Some(prefix) = &self.config.path_prefix {
            format!("{}{}", prefix, object_key)
        } else {
            object_key.to_string()
        };

        info!(
            "Generate presigned URL: {}/{}, expiry time: {} seconds",
            self.config.bucket, full_key, expiry_secs
        );

        let url = self
            .bucket
            .presign_get(&full_key, expiry_secs, None)
            .await
            .context("Generate presigned URL failed")?;

        Ok(url)
    }

    /// 构建访问 URL
    fn build_url(&self, key: &str) -> String {
        if self.config.force_path_style {
            // 路径风格: https://endpoint/bucket/key
            format!(
                "{}/{}/{}",
                self.config.endpoint.trim_end_matches('/'),
                self.config.bucket,
                key
            )
        } else {
            // 虚拟主机风格: https://bucket.endpoint/key
            let endpoint_without_scheme = self
                .config
                .endpoint
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .trim_end_matches('/');

            let scheme = if self.config.endpoint.starts_with("https://") {
                "https://"
            } else {
                "http://"
            };

            format!(
                "{}{}.{}/{}",
                scheme, self.config.bucket, endpoint_without_scheme, key
            )
        }
    }
}
