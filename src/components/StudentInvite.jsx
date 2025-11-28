import { useState, useEffect, useRef } from "react";
import useMessage from "../hooks/useMessage";
import { apiFetch } from "../utils/apiClient.js";
import "./css/StudentInvite.css";

const StudentInvite = ({ classroomCode, onClose, onInvite }) => {
  const { messageComponent, showMessage } = useMessage();

  const showMsgRef = useRef(showMessage);

  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invitedIds, setInvitedIds] = useState([]);

  useEffect(() => {
    showMsgRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/classrooms/${classroomCode}/students`)
      .then(({ data, unauthorized }) => {
        if (unauthorized) {
          showMsgRef.current("Session expired. Please sign in.", "error");
          return;
        }
        if (data?.success && Array.isArray(data.students)) {
          setStudents(data.students);
          setFilteredStudents(data.students);
        } else {
          showMsgRef.current("Failed to fetch students", "error");
        }
      })
      .catch(() => {
        showMsgRef.current("Failed to fetch students", "error");
      })
      .finally(() => setLoading(false));
  }, [classroomCode]);

  useEffect(() => {
    const matches = students.filter((student) =>
      (student.name || student.username || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );

    setFilteredStudents(matches);
  }, [searchTerm, students]);

  const handleInvite = async (studentId) => {
    try {
      const { data, unauthorized } = await apiFetch(
        `/classrooms/${classroomCode}/invite`,
        {
          method: "POST",
          body: JSON.stringify({ studentId }),
        }
      );
      if (unauthorized) {
        showMsgRef.current("Session expired. Please sign in.", "error");
        return;
      }
      if (data?.success) {
        //* remove invited students from the list so teacher won't see them again
        setStudents((prev) => prev.filter((s) => s.id !== studentId));
        setFilteredStudents((prev) => prev.filter((s) => s.id !== studentId));
        setInvitedIds((prev) => [...prev, studentId]);
        if (typeof onInvite === "function") onInvite(studentId);
      } else {
        showMsgRef.current("Invite failed", "error");
      }
    } catch (error) {
      showMsgRef.current("Invite error", "error");
    }
  };

  return (
    <>
      {messageComponent}
      <div className="invite-popup-overlay" onClick={onClose}>
        <div className="invite-section" onClick={(e) => e.stopPropagation()}>
          <h4>Invite Students</h4>
          <input
            type="text"
            placeholder="Enter student name or ID"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="invite-input"
          />

          <div className="invite-results">
            {loading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="invite-results">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="student-card">
                    <img
                      src={student.avatar || "/images/dummy_student_1.jpg"}
                      alt="Profile"
                      className="student-avatar"
                    />
                    <span>{student.name}</span>
                    <button
                      disabled={invitedIds.includes(student.id)}
                      onClick={() => handleInvite(student.id)}
                      className="custom-button"
                    >
                      {invitedIds.includes(student.id) ? "Invited" : "Invite"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!loading && filteredStudents.length === 0 && (
              <p className="no-results">No matching students found.</p>
            )}
          </div>

          <div className="invite-code">
            <span>{classroomCode}</span>
            <button
              className="custom-button"
              onClick={() => navigator.clipboard.writeText(classroomCode)}
            >
              Copy Code
            </button>
          </div>

          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default StudentInvite;
