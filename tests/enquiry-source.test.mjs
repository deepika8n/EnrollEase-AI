import test from "node:test";
import assert from "node:assert/strict";
import { getEnquirySourceMeta } from "../src/utils/enquirySource.js";

test("online enquiries are shown as app enquiries even when they have an email address", () => {
  assert.deepEqual(
    getEnquirySourceMeta({ leadSource: "Online Enquiry", hasReachableEmail: true }),
    { key: "app", label: "Enquired Through App" },
  );
});

test("manual forms with a student email remain in the admin mail source", () => {
  assert.deepEqual(
    getEnquirySourceMeta({ leadSource: "Manual Form", hasReachableEmail: true }),
    { key: "manual_email", label: "Admin Sent Form By Mail" },
  );
});
