function onFormSubmit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Enrollments");
  const values = e.namedValues;

  const row = [
    new Date(),
    values["Student Name"]?.[0] || "",
    values["College Name"]?.[0] || "",
    values["Currently Doing"]?.[0] || "",
    values["Place"]?.[0] || "",
    values["Address"]?.[0] || "",
    values["Student Phone Number"]?.[0] || "",
    values["Email ID"]?.[0] || "",
    values["Guardian Name"]?.[0] || "",
    values["Guardian Relation"]?.[0] || "",
    values["Guardian Number"]?.[0] || "",
    values["Aadhaar ID Number"]?.[0] || "",
    values["Enrolled Course"]?.[0] || "",
    values["Payment Method"]?.[0] || "",
    values["Payment Type"]?.[0] || "",
    values["Number of Installments"]?.[0] || "",
    values["Course Fee"]?.[0] || "",
    values["Lead Date"]?.[0] || "",
    values["Enrolled Date"]?.[0] || "",
    values["Notes"]?.[0] || "",
  ];

  sheet.appendRow(row);
}
