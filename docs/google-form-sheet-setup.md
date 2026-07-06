# Google Form + Google Sheet Setup

Use this setup when you are ready to connect the portal flow to a real Google Form.

## Create the Google Form

Add these fields in the same order:

1. Student Name
2. College Name
3. Currently Doing
4. Place
5. Address
6. Student Phone Number
7. Email ID
8. Guardian Name
9. Guardian Relation
10. Guardian Number
11. Aadhaar ID Number
12. Student Photo
13. Aadhaar ID Photo
14. Enrolled Course
15. Payment Method
16. Payment Type
17. Number of Installments
18. Course Fee
19. Lead Date
20. Enrolled Date
21. Notes

## Link the form to a Google Sheet

1. Open the form.
2. Use `Responses > Link to Sheets`.
3. Name the sheet `Enrollments`.

## Add Apps Script

1. Open the linked Google Sheet.
2. Open `Extensions > Apps Script`.
3. Paste the script from [google-form-apps-script.js](./google-form-apps-script.js).
4. Add an installable trigger for `onFormSubmit`.

## What this project already supports

- The same field structure is already shown inside the portal settings page.
- Student profile PDF export is already working inside the app.
- CSV import is already available for bulk student onboarding.

## Manual note

The live Google Form itself was not created from this environment because that requires your Google account access and authorization.
