import type { Project } from "../types/app";

type ProjectTabsProps = {
  visibleProjects: Project[];
  projects: Project[];
  activeProjectId: string | null;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onSelect: (projectId: string) => void;
  onRename: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onCreate: () => void;
};

export function ProjectTabs({
  visibleProjects,
  projects,
  activeProjectId,
  isMenuOpen,
  onToggleMenu,
  onSelect,
  onRename,
  onDelete,
  onCreate
}: ProjectTabsProps) {
  const controlsClassName = `project-controls${visibleProjects.length <= 1 ? " single-project" : ""}`;

  return (
    <div className="project-bar">
      <div id="projectTabs" className={controlsClassName}>
        {visibleProjects.map((project) => (
          <button
            key={project.id}
            className={`project-tab${project.id === activeProjectId ? " active" : ""}`}
            type="button"
            data-action="select-project"
            data-project-id={project.id}
            onClick={() => onSelect(project.id)}
          >
            {project.name}
          </button>
        ))}
        <button
          className="project-menu-trigger"
          type="button"
          id="projectMenuTrigger"
          data-action="toggle-project-menu"
          aria-expanded={isMenuOpen}
          onClick={onToggleMenu}
        >
          ▾
        </button>
      </div>

      <div className={`dropdown project-dropdown${isMenuOpen ? " open" : ""}`} id="projectDropdown">
        <div className="dropdown-section" id="projectList">
          <div className="dropdown-label">Projects</div>
          {projects.map((project) => (
            <div key={project.id} className="dropdown-row">
              <button
                className={`dropdown-item${project.id === activeProjectId ? " active" : ""}`}
                type="button"
                data-action="select-project"
                data-project-id={project.id}
                onClick={() => onSelect(project.id)}
              >
                <span className="dropdown-item-name">{project.name}</span>
              </button>
              <button
                className="dropdown-icon"
                type="button"
                data-action="rename-project"
                data-project-id={project.id}
                aria-label={`Rename ${project.name}`}
                onClick={() => onRename(project.id)}
              >
                ✎
              </button>
              <button
                className="dropdown-icon"
                type="button"
                data-action="delete-project"
                data-project-id={project.id}
                aria-label={`Delete ${project.name}`}
                onClick={() => onDelete(project.id)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="dropdown-divider"></div>
        <button className="dropdown-action" id="createProjectBtn" type="button" onClick={onCreate}>
          + Create Project
        </button>
      </div>
    </div>
  );
}
