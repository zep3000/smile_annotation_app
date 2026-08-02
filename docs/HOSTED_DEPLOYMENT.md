# Hosted Railway Deployment

This procedure converts the already deployed smoke application into the hosted
annotation system. Complete the service and variable setup before enabling
hosted mode. Until `APP_MODE=hosted` is set, the Railway deployment continues
to run the existing local-mode smoke application.

## What Runs Where

- **Web service:** Node.js application, authentication, admin interface, image
  proxy, annotation API, and export downloads.
- **PostgreSQL service:** annotation sets, assignment codes, JSONB annotations,
  revisions, login sessions, progress, and audit events.
- **Images bucket:** private JPEG originals.
- **Backup bucket:** private scheduled JSON and JSONL research exports. This is separate
  from the images bucket so one bucket failure or accidental deletion does not
  remove both primary images and research exports.
- **Backup cron service:** short-lived daily process that reads PostgreSQL,
  writes exports, and exits.

Bucket credentials and object keys are never sent to annotators. The backend
checks the login and assignment before retrieving an image and returns it with
`Cache-Control: private, no-store`.

## 1. Add PostgreSQL

1. Open the Railway project canvas.
2. Choose **Create** or **New**.
3. Choose **Database**, then **PostgreSQL**.
4. Rename the service to `Postgres` if Railway assigned another name.
5. Wait for the database service to report that it is running.

In the web service's **Variables** tab, add this reference variable:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

The reference means Railway supplies the current private database connection
string. It avoids copying a password and remains valid if Railway rotates the
database credentials.

## 2. Add The Private Image Bucket

1. On the project canvas, choose **Create**, then **Bucket**.
2. Name it `Images`.
3. Choose a region close to the web service. The bucket region cannot be changed
   later.
4. Keep the bucket private. Railway buckets are private by default.

Use Railway's automatic credential injection if offered. Otherwise add these
reference variables to the web service:

```text
AWS_ENDPOINT_URL=${{Images.ENDPOINT}}
AWS_ACCESS_KEY_ID=${{Images.ACCESS_KEY_ID}}
AWS_SECRET_ACCESS_KEY=${{Images.SECRET_ACCESS_KEY}}
AWS_S3_BUCKET_NAME=${{Images.BUCKET}}
AWS_DEFAULT_REGION=${{Images.REGION}}
AWS_S3_URL_STYLE=virtual
```

Use the actual Railway service name in place of `Images` if it differs. The
bucket's Credentials tab indicates `path` instead of `virtual` only for older
buckets; in that case set `AWS_S3_URL_STYLE=path`.

## 3. Configure Application Authentication

Add these variables to the web service:

```text
AUTH_ANNOTATOR_PASSWORD=<shared study password>
AUTH_ADMIN_PASSWORD=<different strong admin password>
AUTH_SESSION_HOURS=12
AUTH_SECURE_COOKIES=true
```

Use different random passwords of at least 16 characters. Seal the two password
variables from their three-dot menus after testing them. The administrator
password should not be given to annotators.

The optional `AUTH_ANNOTATOR_PASSWORD_HASH` and `AUTH_ADMIN_PASSWORD_HASH`
variables can replace plaintext variables. Generate a compatible hash locally:

```powershell
npm run auth:hash -- "a-long-random-password"
```

Only the resulting `scrypt$...` value is placed in Railway. Be aware that a
password supplied directly on a command line may remain in local shell history.

Keep the temporary `STAGING_AUTH_*` variables during the first hosted test. That
creates two gates: the temporary browser Basic Auth prompt and the new in-app
role password. Once the new logins are verified, the staging gate may be removed
by setting:

```text
STAGING_AUTH_REQUIRED=false
```

## 4. Enable Hosted Mode

After PostgreSQL, image-bucket variables, and both role passwords are present,
add:

```text
APP_MODE=hosted
APP_ENV=production
```

Do not define `PORT`; Railway injects it.

Review and deploy all staged changes together. During deployment:

1. `npm run db:migrate` creates or updates the PostgreSQL schema.
2. Railway starts `npm start`.
3. The server connects to PostgreSQL.
4. Railway requests `/ready`.
5. Traffic is switched to the release only after `/ready` returns HTTP 200.

Check these URLs afterward:

```text
https://YOUR-DOMAIN/health
https://YOUR-DOMAIN/ready
https://YOUR-DOMAIN/admin
```

`/health` confirms the process is running. `/ready` additionally confirms that
PostgreSQL is reachable. Neither endpoint exposes images or annotations.

## 5. Create An Annotation Set

Open `/admin` and enter the administrator password.

1. Choose **New set**.
2. Enter a descriptive set name.
3. Keep the current flow version unless intentionally deploying a new codebook.
4. Choose the manifest JSON.
5. Create the set.
6. Choose the directory containing its JPEG files.
7. Upload missing images.
8. Activate the set after every manifest image is stored.
9. Generate one assignment code per coder.

The hosted manifest format is:

```json
{
  "task_id": "pilot_set_01",
  "block_size": 50,
  "images": [
    {
      "image_id": "1964-0704-0078",
      "filename": "1964-0704-0078.jpg",
      "page_type": "single",
      "metadata": {}
    }
  ],
  "metadata": {}
}
```

`block_size` is optional. Use it for large assignments that should remain one
assignment code but be shown to coders in smaller work blocks. If omitted, no
block pause screens are shown.

Only `.jpg` and `.jpeg` files are accepted. Existing absolute `path` properties
are ignored; the hosted manifest stored in PostgreSQL contains filenames and
identifiers, not laptop paths. Image IDs and filenames must each be unique
inside a set.

For several gigabytes, the command-line uploader is more reliable than keeping
a browser upload open. From the project directory:

```powershell
$env:ADMIN_PASSWORD='<admin password>'
$env:STAGING_USER='<temporary staging user>'
$env:STAGING_PASSWORD='<temporary staging password>'
$env:ACTIVATE='true'
$env:ASSIGNMENT_COUNT='5'
npm run upload:set -- `
  https://YOUR-DOMAIN `
  C:\path\manifest.json `
  C:\path\jpeg-directory `
  "Pilot set 01"
```

The command prints the set ID and generated codes. If an upload is interrupted,
set `SET_ID` to the printed ID and rerun the same command; already uploaded
images are skipped.

## 6. Assignment Behavior

- Each eight-digit code belongs to exactly one annotation set and one coder.
- The coder first enters the shared study password, then the assignment code.
- Reloading resumes the same assignment from the secure cookie.
- A code can be revoked or restored in the admin interface.
- Expert page navigation is controlled per assignment.
- Simultaneous saves from two tabs use revision checks. A stale tab receives a
  conflict instead of overwriting newer JSON.
- Deactivating a set immediately blocks assignment access, image access, and
  new annotation saves.

The eight-digit code is an assignment identifier, not the security boundary.
The study password, rate limits, secure cookie, and private image proxy provide
that boundary.

## 7. Results And Monitoring

The admin interface shows image-upload status, assignment state, page progress,
last activity, and recent audit events. It provides:

- JSONL: one complete record per line, suitable for Python streaming.
- JSON: one structured export containing set and annotation records.

Each export contains the original annotation JSON plus set ID, task ID,
assignment code, image ID, status, revision, and server timestamps. Screen-time
and focus-time records remain inside the annotation JSON and are not displayed
to annotators.

## 8. Daily Research Exports

Create a second private Railway bucket named `Backups`. Add a second service
from the same private GitHub repository and name it `Annotation Backups`.

In that service's settings, set its Railway config file path to:

```text
/railway.backup.json
```

That file runs `npm run backup:exports` at `01:00` and `13:00` UTC, corresponding
to `03:00` and `15:00` in Berlin during summer time, and never starts a web
server. It has no public domain. Give the backup service `DATABASE_URL` and
these references to the separate backup bucket:

```text
BACKUP_AWS_ENDPOINT_URL=${{Backups.ENDPOINT}}
BACKUP_AWS_ACCESS_KEY_ID=${{Backups.ACCESS_KEY_ID}}
BACKUP_AWS_SECRET_ACCESS_KEY=${{Backups.SECRET_ACCESS_KEY}}
BACKUP_AWS_S3_BUCKET_NAME=${{Backups.BUCKET}}
BACKUP_AWS_DEFAULT_REGION=${{Backups.REGION}}
BACKUP_AWS_S3_URL_STYLE=virtual
BACKUP_RETENTION_DAYS=7
```

Each run writes matching timestamped JSON and JSONL files and records both
SHA-256 checksums in PostgreSQL audit events and bucket metadata. On plans
without native database backups, also download both formats to a computer at
the end of every annotation day. After a successful export, the job deletes
objects under `backups/annotation-exports/` that are older than seven days.
These research exports preserve analysis data but are not a drop-in restoration
of login sessions or the running database.

## Security Boundary

An authenticated coder must receive image pixels in order to annotate them.
The application can prevent anonymous access, direct bucket access, indexing,
and browser caching, but it cannot prevent an authorized coder from taking a
screenshot or deliberately saving pixels visible on their own device. Only give
study access to trusted participants and revoke codes when their work ends.
