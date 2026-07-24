# n8n Workflow Contract

The frontend sends all automation requests to the single webhook URL configured in `VITE_N8N_WEBHOOK_URL`.

## Important

In the n8n `Webhook` node, the incoming request body is available under `body`.

That means your Switch value should be:

```text
{{$json.body.event}}
```

Not:

```text
{{$json.event}}
```

## Optional Secret Check

If `VITE_N8N_WEBHOOK_SECRET` is set in the app, every request also sends:

- `x-enrollease-secret`

Recommended first nodes:

1. `Webhook`
2. `IF` or `Code` node to validate `{{$json.headers["x-enrollease-secret"]}}`
3. Reject failures with `Respond to Webhook`
4. Continue valid requests into a `Switch`

## Common Headers

Every request includes:

- `x-enrollease-event`
- `x-enrollease-agent`
- `x-enrollease-action`

## Common Request Shape

The frontend posts JSON like this:

```json
{
  "event": "email.payment_update",
  "agentType": "payment_agent",
  "actionType": "send_payment_update_email",
  "flowName": "email_notification",
  "source": "EnrollEase AI",
  "timestamp": "2026-07-16T12:00:00.000Z",
  "payload": {
    "recipientEmail": "student@example.com",
    "subject": "Payment Received - CERTISURED",
    "html": "<html>...</html>",
    "text": "Plain text body"
  }
}
```

Inside n8n, that becomes:

- `{{$json.body.event}}`
- `{{$json.body.agentType}}`
- `{{$json.body.actionType}}`
- `{{$json.body.payload.recipientEmail}}`
- `{{$json.body.payload.subject}}`
- `{{$json.body.payload.html}}`
- `{{$json.body.payload.text}}`

## Event Routes

Use a `Switch` node with first box:

```text
{{$json.body.event}}
```

Add these rules:

- `email.follow_up`
- `email.payment_update`
- `email.payment_reminder`
- `email.admission_confirmation`
- `email.generic`
- `enrollment.enquiry_submitted`
- `enrollment.admission_submitted`
- `enrollment.status_updated`

## Normal Email Routes

These branches can all use the same prepared fields because the frontend already sends ready-to-mail content:

- `email.follow_up`
- `email.payment_update`
- `email.payment_reminder`
- `email.admission_confirmation`
- `email.generic`

For a Gmail node, use:

To

```text
{{$json.body.payload.recipientEmail}}
```

Subject

```text
{{$json.body.payload.subject}}
```

Message

```text
{{$json.body.payload.html || $json.body.payload.text}}
```

Attachments

The app now sends profile-PDF attachment data for `Student Profile Update` and `Profile Send Mail` requests in:

- `{{$json.body.payload.attachments}}`
- `{{$json.body.payload.attachment}}`
- `{{$json.body.payload.profilePdfAttachment}}`

To make Gmail attach the PDF, add a `Code` node before Gmail on the shared email route and use:

```javascript
const payload = $json.body?.payload || {};
const attachment = payload.profilePdfAttachment || payload.attachment || payload.attachments?.[0];

if (!attachment?.contentBase64) {
  return [{ json: payload }];
}

return [{
  json: payload,
  binary: {
    student_profile_pdf: {
      data: attachment.contentBase64,
      fileName: attachment.fileName || 'student-profile.pdf',
      mimeType: attachment.mimeType || 'application/pdf',
    },
  },
}];
```

Then in the Gmail node, set `Attachments` to:

```text
student_profile_pdf
```

Then connect to `Respond to Webhook` with a success payload such as:

```json
{
  "success": true,
  "message": "Email route completed",
  "event": "{{$json.body.event}}"
}
```

## Admission Submission Route

When an enquiry is converted into an enrollment, or a direct enrollment is created, the app now sends:

```json
{
  "event": "enrollment.admission_submitted"
}
```

Use this branch for admin workflows, CRM sync, or internal notifications.

If you want this branch to send the student confirmation email too, insert an `Edit Fields` node before Gmail and map from:

- `{{$json.body.payload.studentRecord.email}}`
- `{{$json.body.payload.studentRecord.full_name}}`
- `{{$json.body.payload.enrollmentRecord.batch}}`

## New Enquiry Admin Alert

Only add this after the normal email routes are working.

Add another `Switch` rule:

First box:

```text
{{$json.body.event}}
```

Second box:

```text
enrollment.enquiry_submitted
```

Rename it:

```text
New Enquiry
```

This branch should not go straight into the shared Gmail node because enquiry events do not include the same ready-made email fields.

From `New Enquiry`, add an `Edit Fields` node.

Name it:

```text
Prepare Enquiry Alert
```

Add these fields:

| Field | Value |
| --- | --- |
| `adminEmail` | Your Gmail address |
| `studentName` | `{{$json.body.payload.studentRecord.full_name}}` |
| `studentEmail` | `{{$json.body.payload.studentRecord.email}}` |
| `studentPhone` | `{{$json.body.payload.studentRecord.phone}}` |
| `courseName` | `{{$json.body.payload.enrollmentRecord.course_name}}` |
| `submittedAt` | `{{$json.body.timestamp}}` |

Then add a new Gmail node:

To

```text
{{$json.adminEmail}}
```

Subject

```text
New enquiry received - {{$json.studentName}}
```

Message

```text
A new enquiry was submitted.

Student: {{$json.studentName}}
Email: {{$json.studentEmail}}
Phone: {{$json.studentPhone}}
Course: {{$json.courseName}}
Submitted at: {{$json.submittedAt}}
```

Then connect it to `Respond to Webhook`:

```json
{
  "success": true,
  "message": "New enquiry alert sent",
  "event": "enrollment.enquiry_submitted"
}
```

## What The App Sends Today

Current app routes:

- Follow-up button -> `email.follow_up`
- Payment update email button -> `email.payment_update`
- EMI reminder email button -> `email.payment_reminder`
- Student confirmation button -> `email.admission_confirmation`
- Generic email fallback -> `email.generic`
- New enquiry form submit -> `enrollment.enquiry_submitted`
- Direct enrollment submit -> `enrollment.admission_submitted`
- Enquiry converted to enrolled -> `enrollment.admission_submitted`
