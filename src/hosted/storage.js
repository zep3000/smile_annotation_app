const {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
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

    async listObjects(prefix) {
      const objects = [];
      let continuationToken;
      do {
        const response = await client.send(new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken
        }));
        objects.push(...(response.Contents || []));
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);
      return objects;
    },

    async deleteObjects(keys) {
      const pending = keys.filter(Boolean);
      for (let index = 0; index < pending.length; index += 20) {
        await Promise.all(pending.slice(index, index + 20).map((key) => client.send(new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key
        }))));
      }
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
