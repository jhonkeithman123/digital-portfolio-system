import React, { useEffect, useState } from "react";
import { apiFetch } from "utils/apiClient";
import "./DrivePicker.css";

type Props = {
  onSelect: (path: string) => void;
  onClose: () => void;
};

export default function DrivePicker({ onSelect, onClose }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, unauthorized } = await apiFetch<{
        files?: { name: string }[];
      }>("/portfolio/drive/files");
      if (unauthorized) return;
      if (data?.files) setFiles(data.files.map((f) => f.name));
    } catch (e) {
      console.error("Drive load error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleSelect = (name: string) => {
    onSelect(name);
    onClose();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const f = e.target.files[0];
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await apiFetch<{ file?: any }>(
        "/portfolio/drive/upload",
        {
          method: "POST",
          body: fd,
          form: true as any,
        } as any,
      );
      if (data?.file?.filename) {
        // refresh list and auto-select
        await load();
      }
    } catch (err) {
      console.error("Upload to drive failed", err);
    } finally {
      setUploading(false);
      // clear file input
      if (e.target) e.target.value = "";
    }
  };

  return (
    <div className="drive-picker-backdrop">
      <div className="drive-picker">
        <div className="drive-header">
          <h4>Drive Files</h4>
          <button onClick={onClose} className="close-btn">
            Close
          </button>
        </div>
        <div className="drive-body">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ul className="drive-list">
              {files.map((f) => (
                <li key={f}>
                  <button
                    onClick={() => handleSelect(f)}
                    className="drive-item"
                  >
                    {f}
                  </button>
                </li>
              ))}
              {files.length === 0 && <li>No files in Drive</li>}
            </ul>
          )}

          <div className="drive-upload">
            <label className="upload-label">
              <input type="file" onChange={handleUpload} />
              {uploading ? "Uploading..." : "Upload to Drive"}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
