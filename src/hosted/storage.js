const {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} = require("@aws-sdk/client-s3");

function createStorage(config) {
  const client = new S3Client({
    endpoint: config.bucketEndpoint,
    region: config.bucketRegion,
    forcePathStyle: config.bucketForcePathStyle,
    credentials: {
      accessKeyId: config.bucketAccessKeyId,
      secretAccessKey: config.bucketSecretAccessKey
    }
  });

  return {
    async putObject(key, body, contentType, metadata = {}) {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "private, no-store",
        Metadata: metadata
      }));
    },

    async putJpeg(key, body, metadata = {}) {
      await this.putObject(key, body, "image/jpeg", metadata);
    },

    async getJpeg(key) {
      return client.send(new GetObjectCommand({
        Bucket: config.bucket,
        Key: key
      }));
    },

    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
        return true;
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") return false;
        throw error;
      }
    }
  };
}

module.exports = { createStorage };
