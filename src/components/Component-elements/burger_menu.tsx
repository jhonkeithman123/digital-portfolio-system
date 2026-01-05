import React, { useEffect, useState } from "react";
import "./css/burger_menu.css";

type ClassroomInfo = {
  name?: string | null;
  section?: string | null;
  code?: string | null;
  [k: string]: any;
} | null;

type MessageFn = (msg: string, type?: "info" | "success" | "error") => void;

interface BurgerMenuProps {
  openMenu: boolean;
  toggleMenu: React.Dispatch<React.SetStateAction<boolean>>;
  classroomInfo?: ClassroomInfo;
  showMessage: MessageFn;
}

const BurgerMenu: React.FC<BurgerMenuProps> = ({
  openMenu,
  toggleMenu,
  classroomInfo,
  showMessage,
}): React.ReactElement => {
  const [copyCooldown, setCopyCooldown] = useState<boolean>(false);
  const COOLDOWN_MS = 2500;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleMenu(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMenu]);

  const sectionValue = classroomInfo?.section || null;
  const hasCode = !!classroomInfo?.code;
  const canCopy = hasCode && !copyCooldown;

  const handleCopy = async () => {
    if (!canCopy || !classroomInfo?.code) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(classroomInfo?.code);
        showMessage("Code copied", "info");
      } else {
        showMessage("Clipboard not supported", "error");
      }
      setCopyCooldown(true);

      const t = window.setTimeout(() => setCopyCooldown(false), COOLDOWN_MS);
      void t;
    } catch (err) {
      showMessage("Failed to copy code", "error");
      setCopyCooldown(false);
    }
  };

  return (
    <div className="burger-menu" role="region" aria-label="Menu">
      <button
        className={`burger-toggle ${openMenu ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={openMenu}
        aria-controls="burger-dropdown"
        onClick={() => toggleMenu((prev) => !prev)}
      >
        <span className="line top"></span>
        <span className="line middle"></span>
        <span className="line bottom"></span>
      </button>

      {openMenu && (
        <div className="burger-overlay" onClick={() => toggleMenu(false)} />
      )}

      <div
        id="burger-dropdown"
        className={`burger-dropdown ${openMenu && classroomInfo ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        {classroomInfo ? (
          <>
            <h3>Advisory Classroom</h3>
            <p>
              <strong>Name:</strong> {classroomInfo.name || "-"}
            </p>
            {sectionValue && (
              <p>
                <strong>Section:</strong> {sectionValue}
              </p>
            )}
            <p>
              <strong>Code:</strong> {hasCode ? classroomInfo.code : "-"}
            </p>
            <button
              type="button"
              className={`copy-code-btn ${!hasCode ? "loading" : ""} ${
                copyCooldown ? "cooldown" : ""
              }`}
              disabled={!canCopy}
              aria-disabled={!canCopy}
              onClick={handleCopy}
            >
              {!hasCode
                ? "Waiting Code"
                : copyCooldown
                ? "Copied!"
                : "Copy Code"}
            </button>
          </>
        ) : (
          <p>Loading classroom info</p>
        )}
      </div>
    </div>
  );
};

export default BurgerMenu;
