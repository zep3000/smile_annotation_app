# Annotation App V2

Local browser app for stepwise annotation of advertisements with visible faces.

## Run

```powershell
cd C:\master\annotation_app_v2
npm start
```

Then open:

```text
http://localhost:5176
```

## Expert mode

Start the app in expert mode when unrestricted navigation through the Pages overview is needed:

```powershell
npm run start:expert
```

The equivalent direct launch flag is `node server.js --expert`. Expert mode is shown in the top bar and allows opening any manifest page from the Pages overview. Standard `npm start` retains sequential page access. The overview marks pages as Not started, Started, or Done in both modes.

## Resume or edit annotations

On the welcome screen, choose **Resume annotation**. No name or manifest path is required: the app lists every loadable saved session with its session ID, task, timestamp, and Done and Started page counts. Older sessions remain available under their existing IDs.

Opening a session restores its manifest automatically. It resumes the first unfinished page; if no draft exists, it opens the first untouched page.

Starting a new annotation creates a random eight-digit session number. Copy the number when prompted; it remains visible in the top bar throughout annotation.

Previously reached pages remain available in the Pages overview. Open a completed page and choose **Edit annotation** to return to its saved flow and change answers or boxes. Changes continue to save into the original session.

## Manifest

The app expects a JSON manifest with absolute image paths:

```json
{
  "task_id": "test_collection_100_v2",
  "images": [
    {
      "image_id": "1901-1012-0036",
      "filename": "1901-1012-0036.jpg",
      "path": "C:/master/code/test_collection_100/1901-1012-0036.jpg",
      "page_type": "single",
      "metadata": {}
    }
  ]
}
```

A generated manifest for the current 100-image sample is available here:

```text
C:\master\annotation_app_v2\data\test_collection_100_manifest.json
```

## Outputs

Annotations are saved per session:

```text
C:\master\annotation_app_v2\data\annotations\<eight_digit_session_id>\<image_id>.json
C:\master\annotation_app_v2\data\annotations\<eight_digit_session_id>\annotations.jsonl
```

The copied source documents for the annotation flow are in `docs/`.
