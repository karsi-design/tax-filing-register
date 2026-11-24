import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

// --- Doc type keys used throughout the app. Add/remove here if your
// columns change, and the UI will follow automatically (see app/page.tsx). ---
export const DOC_TYPES = [
  { key: "itr", label: "ITR" },
  { key: "computation", label: "Computation" },
  { key: "balanceSheet", label: "Balance Sheet" },
  { key: "taxAudit", label: "Tax Audit Report" },
] as const;

export type DocKey = (typeof DOC_TYPES)[number]["key"];

export type FilingRecord = {
  folderId: string;
  ay: string;
  fy: string;
  docs: Partial<Record<DocKey, { fileId: string; name: string; mimeType: string; modifiedTime: string }>>;
};

function getAuth() {
  // OAuth as a real Google account, not a service account: service accounts have
  // zero storage quota of their own and Drive refuses to let them create files
  // in a regular (non-Shared-Drive) folder, even with Editor access. Authenticating
  // as yourself writes against your own quota instead, with no such restriction.
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN env vars. " +
        "Run `node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>` once to generate them — see README.md."
    );
  }
  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return oAuth2Client;
}

export function getDrive(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: getAuth() });
}

function rootFolderId() {
  const id = process.env.DRIVE_ROOT_FOLDER_ID;
  if (!id) throw new Error("Missing DRIVE_ROOT_FOLDER_ID env var. See .env.local.example.");
  return id;
}

// A year folder is named "AY <ay>" and carries the financial year in its
// Drive "description" field (kept as "FY <fy>") — no extra metadata file needed.
const AY_FOLDER_RE = /^AY (.+)$/;
const FY_DESC_RE = /^FY (.+)$/;

function docKeyForFileName(name: string): DocKey | null {
  const prefix = name.split(".")[0];
  const match = DOC_TYPES.find((d) => d.key === prefix);
  return match ? match.key : null;
}

export type Person = { id: string; name: string };

/** Lists every family member — one subfolder per person, directly under the root. */
export async function listPeople(): Promise<Person[]> {
  const drive = getDrive();
  const root = rootFolderId();

  const res = await drive.files.list({
    q: `'${root}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 200,
  });

  return (res.data.files ?? [])
    .filter((f) => f.id && f.name)
    .map((f) => ({ id: f.id!, name: f.name! }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Finds a family member's folder by name, creating it under the root if missing. */
export async function ensurePerson(name: string): Promise<Person> {
  const drive = getDrive();
  const root = rootFolderId();
  const safeName = name.replace(/'/g, "\\'");

  const existing = await drive.files.list({
    q: `'${root}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
  });
  if (existing.data.files && existing.data.files.length > 0) {
    const f = existing.data.files[0];
    return { id: f.id!, name: f.name! };
  }

  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [root] },
    fields: "id, name",
  });
  return { id: created.data.id!, name: created.data.name! };
}

/** Lists every filing-year folder under one person's folder, each with its uploaded documents. */
export async function listRecords(personId: string): Promise<FilingRecord[]> {
  const drive = getDrive();

  const foldersRes = await drive.files.list({
    q: `'${personId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name, description)",
    pageSize: 200,
  });
  const folders = foldersRes.data.files ?? [];

  const records: FilingRecord[] = [];
  for (const folder of folders) {
    const ayMatch = AY_FOLDER_RE.exec(folder.name ?? "");
    if (!ayMatch || !folder.id) continue;
    const fyMatch = FY_DESC_RE.exec(folder.description ?? "");

    const filesRes = await drive.files.list({
      q: `'${folder.id}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, modifiedTime)",
      pageSize: 20,
    });
    const docs: FilingRecord["docs"] = {};
    for (const f of filesRes.data.files ?? []) {
      const key = docKeyForFileName(f.name ?? "");
      if (key && f.id) {
        docs[key] = {
          fileId: f.id,
          name: f.name!,
          mimeType: f.mimeType ?? "application/octet-stream",
          modifiedTime: f.modifiedTime ?? "",
        };
      }
    }

    records.push({
      folderId: folder.id,
      ay: ayMatch[1],
      fy: fyMatch ? fyMatch[1] : "—",
      docs,
    });
  }

  // Newest assessment year first.
  records.sort((a, b) => b.ay.localeCompare(a.ay));
  return records;
}

/** Finds an AY folder by year inside a person's folder, creating it (with its FY description) if missing. */
export async function ensureYearFolder(personId: string, ay: string, fy: string): Promise<string> {
  const drive = getDrive();
  const folderName = `AY ${ay}`;

  const existing = await drive.files.list({
    q: `'${personId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
  });
  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [personId],
      description: `FY ${fy}`,
    },
    fields: "id",
  });
  return created.data.id!;
}

/** Uploads a document into a year's folder, replacing any existing file of the same docType. */
export async function uploadDoc(
  folderId: string,
  docType: DocKey,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ fileId: string; name: string }> {
  const drive = getDrive();

  // Remove any previous file for this doc type (the chip shows one file per type).
  const existing = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name)",
  });
  for (const f of existing.data.files ?? []) {
    if (docKeyForFileName(f.name ?? "") === docType && f.id) {
      await drive.files.delete({ fileId: f.id });
    }
  }

  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  const storedName = `${docType}${ext}`;

  const { Readable } = await import("stream");
  const created = await drive.files.create({
    requestBody: { name: storedName, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, name",
  });

  return { fileId: created.data.id!, name: created.data.name! };
}

/** Deletes a single uploaded document. */
export async function deleteDoc(fileId: string): Promise<void> {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}

/** Streams a file's bytes + metadata straight from Drive, for preview or download. */
export async function getFileStream(fileId: string) {
  const drive = getDrive();
  const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
  const content = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return {
    name: meta.data.name ?? "file",
    mimeType: meta.data.mimeType ?? "application/octet-stream",
    stream: content.data as NodeJS.ReadableStream,
  };
}
