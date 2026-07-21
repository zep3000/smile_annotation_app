function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
}

function integerValue(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function firstValue(environment, names) {
  for (const name of names) {
    const value = String(environment[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function loadConfig(environment = process.env) {
  const config = {
    appEnv: String(environment.APP_ENV || "development"),
    host: String(environment.HOST || "0.0.0.0"),
    port: Number(environment.PORT || 5176),
    databaseUrl: String(environment.DATABASE_URL || "").trim(),
    databaseSsl: booleanValue(environment.DATABASE_SSL, false),
    sessionHours: integerValue(environment.AUTH_SESSION_HOURS, 12),
    annotatorPassword: String(environment.AUTH_ANNOTATOR_PASSWORD || ""),
    annotatorPasswordHash: String(environment.AUTH_ANNOTATOR_PASSWORD_HASH || ""),
    adminPassword: String(environment.AUTH_ADMIN_PASSWORD || ""),
    adminPasswordHash: String(environment.AUTH_ADMIN_PASSWORD_HASH || ""),
    secureCookies: booleanValue(
      environment.AUTH_SECURE_COOKIES,
      String(environment.APP_ENV || "development") !== "development"
    ),
    stagingAuthRequired: booleanValue(environment.STAGING_AUTH_REQUIRED, false),
    stagingUser: String(environment.STAGING_USER || ""),
    stagingPassword: String(environment.STAGING_PASSWORD || ""),
    bucket: firstValue(environment, ["AWS_S3_BUCKET_NAME", "BUCKET_NAME", "BUCKET"]),
    bucketEndpoint: firstValue(environment, ["AWS_ENDPOINT_URL", "BUCKET_ENDPOINT", "ENDPOINT"]),
    bucketRegion: firstValue(environment, ["AWS_DEFAULT_REGION", "BUCKET_REGION", "REGION"]) || "auto",
    bucketAccessKeyId: firstValue(environment, ["AWS_ACCESS_KEY_ID", "BUCKET_ACCESS_KEY_ID", "ACCESS_KEY_ID"]),
    bucketSecretAccessKey: firstValue(environment, ["AWS_SECRET_ACCESS_KEY", "BUCKET_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY"]),
    bucketForcePathStyle: firstValue(environment, ["AWS_S3_URL_STYLE"]).toLowerCase() === "path",
    backupBucket: firstValue(environment, ["BACKUP_AWS_S3_BUCKET_NAME", "BACKUP_BUCKET_NAME"]),
    backupBucketEndpoint: firstValue(environment, ["BACKUP_AWS_ENDPOINT_URL", "BACKUP_BUCKET_ENDPOINT"]),
    backupBucketRegion: firstValue(environment, ["BACKUP_AWS_DEFAULT_REGION", "BACKUP_BUCKET_REGION"]) || "auto",
    backupBucketAccessKeyId: firstValue(environment, ["BACKUP_AWS_ACCESS_KEY_ID", "BACKUP_BUCKET_ACCESS_KEY_ID"]),
    backupBucketSecretAccessKey: firstValue(environment, ["BACKUP_AWS_SECRET_ACCESS_KEY", "BACKUP_BUCKET_SECRET_ACCESS_KEY"]),
    backupBucketForcePathStyle: firstValue(environment, ["BACKUP_AWS_S3_URL_STYLE"]).toLowerCase() === "path",
    backupRetentionDays: integerValue(environment.BACKUP_RETENTION_DAYS, 7),
    maxJpegBytes: integerValue(environment.MAX_JPEG_BYTES, 60 * 1024 * 1024)
  };

  const missing = [];
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (!config.bucket) missing.push("AWS_S3_BUCKET_NAME");
  if (!config.bucketEndpoint) missing.push("AWS_ENDPOINT_URL");
  if (!config.bucketAccessKeyId) missing.push("AWS_ACCESS_KEY_ID");
  if (!config.bucketSecretAccessKey) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!config.annotatorPassword && !config.annotatorPasswordHash) {
    missing.push("AUTH_ANNOTATOR_PASSWORD or AUTH_ANNOTATOR_PASSWORD_HASH");
  }
  if (!config.adminPassword && !config.adminPasswordHash) {
    missing.push("AUTH_ADMIN_PASSWORD or AUTH_ADMIN_PASSWORD_HASH");
  }
  if (config.stagingAuthRequired && (!config.stagingUser || !config.stagingPassword)) {
    missing.push("STAGING_USER and STAGING_PASSWORD");
  }
  if (missing.length) {
    throw new Error(`Hosted mode is missing required configuration: ${missing.join(", ")}`);
  }
  return config;
}

function loadBackupConfig(environment = process.env) {
  const config = {
    databaseUrl: String(environment.DATABASE_URL || "").trim(),
    databaseSsl: booleanValue(environment.DATABASE_SSL, false),
    bucket: firstValue(environment, ["BACKUP_AWS_S3_BUCKET_NAME", "BACKUP_BUCKET_NAME"]),
    bucketEndpoint: firstValue(environment, ["BACKUP_AWS_ENDPOINT_URL", "BACKUP_BUCKET_ENDPOINT"]),
    bucketRegion: firstValue(environment, ["BACKUP_AWS_DEFAULT_REGION", "BACKUP_BUCKET_REGION"]) || "auto",
    bucketAccessKeyId: firstValue(environment, ["BACKUP_AWS_ACCESS_KEY_ID", "BACKUP_BUCKET_ACCESS_KEY_ID"]),
    bucketSecretAccessKey: firstValue(environment, ["BACKUP_AWS_SECRET_ACCESS_KEY", "BACKUP_BUCKET_SECRET_ACCESS_KEY"]),
    bucketForcePathStyle: firstValue(environment, ["BACKUP_AWS_S3_URL_STYLE"]).toLowerCase() === "path",
    backupRetentionDays: integerValue(environment.BACKUP_RETENTION_DAYS, 7)
  };
  const missing = [];
  if (!config.databaseUrl) missing.push("DATABASE_URL");
  if (!config.bucket) missing.push("BACKUP_AWS_S3_BUCKET_NAME");
  if (!config.bucketEndpoint) missing.push("BACKUP_AWS_ENDPOINT_URL");
  if (!config.bucketAccessKeyId) missing.push("BACKUP_AWS_ACCESS_KEY_ID");
  if (!config.bucketSecretAccessKey) missing.push("BACKUP_AWS_SECRET_ACCESS_KEY");
  if (missing.length) {
    throw new Error(`Backup job is missing required configuration: ${missing.join(", ")}`);
  }
  return config;
}

module.exports = { booleanValue, loadBackupConfig, loadConfig };
