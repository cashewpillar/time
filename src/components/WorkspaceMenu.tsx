import type { Workspace } from "../types/app";

type WorkspaceMenuProps = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  isOpen: boolean;
  title: string;
  onToggle: () => void;
  onSelect: (workspaceId: string) => void;
  onRename: (workspaceId: string) => void;
  onDelete: (workspaceId: string) => void;
  onCreate: () => void;
};

export function WorkspaceMenu({
  workspaces,
  activeWorkspaceId,
  isOpen,
  title,
  onToggle,
  onSelect,
  onRename,
  onDelete,
  onCreate
}: WorkspaceMenuProps) {
  return (
    <div>
      <button
        className="workspace-trigger"
        id="workspaceTrigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls="workspaceDropdown"
        onClick={onToggle}
      >
        <span id="workspaceTitle">{title}</span>
        <span className="caret">▾</span>
      </button>

      <div className={`dropdown${isOpen ? " open" : ""}`} id="workspaceDropdown">
        <div className="dropdown-section" id="workspaceList">
          <div className="dropdown-label">Workspaces</div>
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="dropdown-row">
              <button
                className={`dropdown-item${workspace.id === activeWorkspaceId ? " active" : ""}`}
                type="button"
                data-action="select-workspace"
                data-workspace-id={workspace.id}
                onClick={() => onSelect(workspace.id)}
              >
                <span className="dropdown-item-name">{workspace.name}</span>
              </button>
              <button
                className="dropdown-icon"
                type="button"
                data-action="rename-workspace"
                data-workspace-id={workspace.id}
                aria-label={`Rename ${workspace.name}`}
                onClick={() => onRename(workspace.id)}
              >
                ✎
              </button>
              <button
                className="dropdown-icon"
                type="button"
                data-action="delete-workspace"
                data-workspace-id={workspace.id}
                aria-label={`Delete ${workspace.name}`}
                onClick={() => onDelete(workspace.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="dropdown-divider"></div>
        <button className="dropdown-action" id="createWorkspaceBtn" type="button" onClick={onCreate}>
          + Create Workspace
        </button>
      </div>
    </div>
  );
}
