import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Component-elements/Header";
import {
  localStorageGet,
  localStorageRemove,
  localStorageSet,
} from "../../utils/modifyFromLocalStorage";
import "./RoleSelect.css";
import { apiFetch } from "../../utils/apiClient";

const RoleSelect = () => {
  const navigate = useNavigate();

  const handleSelect = (role) => {
    try {
      localStorage.setItem("role", role);
    } catch (e) {
      //* Ignore
    }
    navigate(`/login`);
  };

  useEffect(() => {
    localStorageRemove({ keys: ["role"] });
    const token = localStorageGet({ keys: ["token"] })[0];
    if (!token) return;

    let cancelled = false;
    async function init() {
      try {
        const { data } = await apiFetch("/auth/session", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data?.success) {
          localStorageRemove({ keys: ["role"] });
          localStorageSet({
            keys: ["user"],
            values: [JSON.stringify(data.user), data.user.role],
          });
          navigate("/dash");
        }
      } catch (e) {
        if (cancelled) return;
        localStorageRemove({ keys: ["user", "token"] });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const bgUrl = `${process.env.PUBLIC_URL || ""}/classroom.jpg`;

  return (
    <>
      <Header variant="public" />
      <div className="rs-root">
        <div
          className="rs-bg"
          role="presentation"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
        <div className="rs-overlay" />
        <section className="rs-card" aria-labelledby="rs-title">
          <h2 id="rs-title" className="rs-title">
            Choose your role
          </h2>

          <p className="rs-sub">
            Pick Student or Teacher to continue. You can change this later from
            your profile.
          </p>

          <div className="rs-buttons" role="list">
            <button
              role="listitem"
              aria-label="Continue as Student"
              className="rs-btn rs-student"
              onClick={() => handleSelect("student")}
            >
              <span className="rs-emoji" aria-hidden>
                🎓
              </span>
              <span>Student</span>
            </button>

            <button
              role="listitem"
              aria-label="Continue as Teacher"
              className="rs-btn rs-teacher"
              onClick={() => handleSelect("teacher")}
            >
              <span className="rs-emoji" aria-hidden>
                🧑‍🏫
              </span>
              <span>Teacher</span>
            </button>
          </div>

          <small className="rs-foot">
            Secure sign in will be required next.
          </small>
        </section>
      </div>
    </>
  );
};

export default RoleSelect;
