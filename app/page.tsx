"use client";

import { useEffect, useState } from "react";

const DOC_TYPES = [
  { key: "itr", label: "ITR" },
  { key: "computation", label: "Computation" },
  { key: "balanceSheet", label: "Balance Sheet" },
  { key: "taxAudit", label: "Tax Audit Report" },
] as const;
type DocKey = (typeof DOC_TYPES)[number]["key"];

type Doc = { fileId: string; name: string; mimeType: string; modifiedTime: string };
type Record_ = { folderId: string; ay: string; fy: string; docs: Partial<Record<DocKey, Doc>> };
type Person = { id: string; name: string };

export default function Page() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [records, setRecords] = useState<Record_[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | { kind: "doc"; record: Record_; docType: DocKey }
    | { kind: "addYear" }
    | { kind: "addPerson" }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function loadPeople(selectId?: string) {
    try {
      const res = await fetch("/api/people");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load family members");
      setPeople(data.people);
      setError(null);
      if (selectId) {
        setSelectedPersonId(selectId);
      } else if (!selectedPersonId && data.people.length > 0) {
        setSelectedPersonId(data.people[0].id);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function loadRecords(personId: string) {
    try {
      const res = await fetch(`/api/records?personId=${encodeURIComponent(personId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRecords(data.records);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  useEffect(() => {
    if (selectedPersonId) {
      setRecords(null);
      loadRecords(selectedPersonId);
    } else {
      setRecords(null);
    }
  }, [selectedPersonId]);

  async function handleAddPerson(name: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add family member");
      await loadPeople(data.person.id);
      setModal(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(record: Record_, docType: DocKey, file: File) {
    if (!selectedPersonId) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("folderId", record.folderId);
      form.append("docType", docType);
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      await loadRecords(selectedPersonId);
      setModal(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(doc: Doc) {
    if (!selectedPersonId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: doc.fileId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      await loadRecords(selectedPersonId);
      setModal(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddYear(ay: string, fy: string) {
    if (!selectedPersonId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: selectedPersonId, ay, fy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add year");
      await loadRecords(selectedPersonId);
      setModal(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const selectedPerson = people?.find((p) => p.id === selectedPersonId) ?? null;

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <div className="mark">FR</div>
          <div>
            <h1>Filing Register</h1>
            <div className="sub">Every year&rsquo;s return, computation, balance sheet and audit report, stored in Drive.</div>
          </div>
        </div>
        {selectedPersonId && (
          <button className="addbtn" onClick={() => setModal({ kind: "addYear" })}>
            + Add filing year
          </button>
        )}
      </header>

      <div className="personbar">
        <label htmlFor="personSelect">Family member</label>
        <select
          id="personSelect"
          value={selectedPersonId ?? ""}
          onChange={(e) => setSelectedPersonId(e.target.value || null)}
          disabled={!people || people.length === 0}
        >
          {(!people || people.length === 0) && <option value="">No family members yet</option>}
          {people?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className="addbtn ghost" onClick={() => setModal({ kind: "addPerson" })}>
          + Add family member
        </button>
      </div>

      {error && <p style={{ color: "var(--missing)" }}>{error}</p>}

      <div className="register">
        {!selectedPersonId ? (
          <div className="empty">
            Add a family member to start their filing register.
            <br />
            <button className="addbtn" style={{ marginTop: 14 }} onClick={() => setModal({ kind: "addPerson" })}>
              + Add family member
            </button>
          </div>
        ) : records === null ? (
          <div className="empty">Loading…</div>
        ) : records.length === 0 ? (
          <div className="empty">
            No filing years yet.
            <br />
            <button className="addbtn" style={{ marginTop: 14 }} onClick={() => setModal({ kind: "addYear" })}>
              + Add filing year
            </button>
          </div>
        ) : (
          <>
            <div className="row head">
              <div>Year</div>
              {DOC_TYPES.map((d) => (
                <div key={d.key}>{d.label}</div>
              ))}
            </div>
            {records.map((rec) => (
              <div className="row" key={rec.folderId}>
                <div className="yearcell">
                  <div className="ay">AY {rec.ay}</div>
                  <div className="fy">FY {rec.fy}</div>
                </div>
                {DOC_TYPES.map((dt) => {
                  const doc = rec.docs[dt.key];
                  return (
                    <div className="doccell" data-label={dt.label} key={dt.key}>
                      <button
                        className={"chip" + (doc ? " filled" : "")}
                        onClick={() => setModal({ kind: "doc", record: rec, docType: dt.key })}
                      >
                        <span className="dot" />
                        <span className="fname">{doc ? doc.name : "Not uploaded"}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      <footer>
        {selectedPerson
          ? `Documents for ${selectedPerson.name} are stored in Google Drive, in a folder per assessment year.`
          : "Documents are stored in Google Drive, one folder per family member, one subfolder per assessment year."}
      </footer>

      {modal?.kind === "doc" && (
        <DocModal
          record={modal.record}
          docType={modal.docType}
          busy={busy}
          onClose={() => setModal(null)}
          onUpload={(file) => handleUpload(modal.record, modal.docType, file)}
          onRemove={handleRemove}
        />
      )}
      {modal?.kind === "addYear" && (
        <AddYearModal busy={busy} onClose={() => setModal(null)} onSave={handleAddYear} />
      )}
      {modal?.kind === "addPerson" && (
        <AddPersonModal busy={busy} onClose={() => setModal(null)} onSave={handleAddPerson} />
      )}
    </div>
  );
}

function AddPersonModal({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Add family member</h2>
        <div className="body">
          <div className="newform" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              <label>Name</label>
              <input placeholder="e.g. Poonam Mittal" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="actions">
            <button
              className="primary"
              style={{ flex: "none" }}
              disabled={busy || !name.trim()}
              onClick={() => onSave(name.trim())}
            >
              Add
            </button>
          </div>
        </div>
        <div className="closebar">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function DocModal({
  record,
  docType,
  busy,
  onClose,
  onUpload,
  onRemove,
}: {
  record: Record_;
  docType: DocKey;
  busy: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  onRemove: (doc: Doc) => void;
}) {
  const label = DOC_TYPES.find((d) => d.key === docType)!.label;
  const doc = record.docs[docType];

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{label}</h2>
        <div className="mmeta">
          AY {record.ay} &nbsp;&middot;&nbsp; FY {record.fy}
        </div>
        <div className="body">
          {doc ? (
            doc.mimeType === "application/pdf" ? (
              <div className="preview-box" style={{ minHeight: 360, padding: 0 }}>
                <iframe src={`/api/file/${doc.fileId}`} style={{ width: "100%", height: 360, border: "none" }} />
              </div>
            ) : doc.mimeType.startsWith("image/") ? (
              <div className="preview-box">
                <img src={`/api/file/${doc.fileId}`} alt={doc.name} style={{ maxWidth: "100%", maxHeight: 300 }} />
              </div>
            ) : (
              <div className="preview-box">
                {doc.name}
                <br />
                <span style={{ fontSize: 11 }}>Preview not available for this file type &mdash; use download.</span>
              </div>
            )
          ) : (
            <div className="preview-box">Nothing uploaded yet for this document.</div>
          )}

          <div className="actions">
            {doc && (
              <a href={`/api/file/${doc.fileId}?download=1`} className="primary" download={doc.name}>
                Download
              </a>
            )}
            <label>
              {doc ? "Replace" : "Upload"}
              <input
                type="file"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
            </label>
            {doc && (
              <button className="danger" disabled={busy} onClick={() => onRemove(doc)}>
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="closebar">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function AddYearModal({
  busy,
  onClose,
  onSave,
}: {
  busy: boolean;
  onClose: () => void;
  onSave: (ay: string, fy: string) => void;
}) {
  const [ay, setAy] = useState("");
  const [fy, setFy] = useState("");

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Add filing year</h2>
        <div className="body">
          <div className="newform">
            <div>
              <label>Assessment Year</label>
              <input placeholder="2025-26" value={ay} onChange={(e) => setAy(e.target.value)} />
            </div>
            <div>
              <label>Financial Year</label>
              <input placeholder="2024-25" value={fy} onChange={(e) => setFy(e.target.value)} />
            </div>
          </div>
          <div className="actions">
            <button
              className="primary"
              style={{ flex: "none" }}
              disabled={busy || !ay.trim() || !fy.trim()}
              onClick={() => onSave(ay.trim(), fy.trim())}
            >
              Add year
            </button>
          </div>
        </div>
        <div className="closebar">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}