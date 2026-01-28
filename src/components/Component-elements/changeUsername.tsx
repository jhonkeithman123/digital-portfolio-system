import React, { useState } from "react";
import { apiFetch } from "utils/apiClient";
import useMessage from "hooks/useMessage";
import useConfirm from "hooks/useConfirm";
import "./css/changeUsername.css";

export default function ChangeUsername(): React.ReactElement {
  const [newUsername, setNewUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { messageComponent, showMessage } = useMessage();
  const [confirm, ConfirmModal] = useConfirm();

  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUsername.trim()) {
      showMessage("Username cannot be empty", "error");
      return;
    }

    if (newUsername.length < 3) {
      showMessage("Username must be at least 3 characters", "error");
      return;
    }

    const confirmed = await confirm({
      title: "Change Username",
      message: `Are you sure you want to change your username to "${newUsername}"?`,
      confirmText: "Change Username",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const { data, unauthorized } = await apiFetch("/auth/change-username", {
        method: "PATCH",
        body: JSON.stringify({ newUsername, currentPassword }),
      });

      if (unauthorized) {
        showMessage("Session expired. Please sign in again.", "error");
        return;
      }

      if (data?.success) {
        showMessage("Username changed successfully!", "success");
        // Update localStorage
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        user.username = newUsername;
        localStorage.setItem("user", JSON.stringify(user));
        setNewUsername("");
        setCurrentPassword("");
      } else {
        showMessage(data?.message || "Failed to change username", "error");
      }
    } catch (err) {
      showMessage("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-username-container">
      {messageComponent}
      <ConfirmModal />
      <h2>Change Username</h2>
      <form onSubmit={handleChangeUsername} className="username-form">
        <div className="form-group">
          <label htmlFor="newUsername">New Username</label>
          <input
            id="newUsername"
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Enter new username"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="currentPassword">Confirm with Password</label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Changing..." : "Change Username"}
        </button>
      </form>
    </div>
  );
}
