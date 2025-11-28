import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../utils/apiClient.js";
import useMessage from "../../hooks/useMessage";
import useLogout from "../../hooks/useLogout";
import TokenGuard from "../../components/auth/tokenGuard";
import "./css/CreateClassroom.css";

const CreateClassroom = () => {
  const navigate = useNavigate();
  const [logout, LogoutModal] = useLogout();
  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  const [name, setName] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [section, setSection] = useState("");

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  const handleCreate = () => {
    if (!name || !schoolYear) {
      return showMsgRef.current("Please fill all fields.", "error");
    }
    const payload = { name, schoolYear };
    if (section.trim()) payload.section = section.trim();

    apiFetch(`/classrooms/create`, {
      method: "POST",
      body: JSON.stringify({ payload }),
    })
      .then(({ data, unauthorized }) => {
        if (unauthorized)
          return showMsgRef.current(
            "Session expired. Please sign in again.",
            "error"
          );
        if (data?.success) {
          showMsgRef.current("Successfully created a classroom", "success");
          navigate("/dash");
        } else {
          showMsgRef.current(
            data?.error || "Failed to create classroom.",
            "error"
          );
        }
      })
      .catch(() =>
        showMsgRef.current("Server error. Try again later.", "error")
      );
  };

  return (
    <TokenGuard
      redirectInfo="/login"
      onExpire={() =>
        showMsgRef.current("Session expired. Please sign in again.", "error")
      }
    >
      {messageComponent}

      <div className="create-classroom-wrapper">
        <div className="create-classroom-container">
          <h1>Create Your Advisory Classroom</h1>
          <input
            className="create-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Classroom Name"
          />
          <input
            className="create-input"
            type="text"
            value={schoolYear}
            onChange={(e) => setSchoolYear(e.target.value)}
            placeholder="School Year (e.g. 2025-2026)"
          />
          <input
            className="create-input"
            type="text"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="Section (e.g. STEM-2)"
          />
          <button className="create-button" onClick={handleCreate}>
            Create Classroom
          </button>
          <LogoutModal />
          <button className="create-button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </TokenGuard>
  );
};

export default CreateClassroom;
