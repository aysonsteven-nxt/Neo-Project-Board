import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api';
import type { ProjectData, Story, Epic, Subtask, Sprint, Status, Priority } from './types';
import './styles.css';

const statuses: Status[] = ['todo', 'in-progress', 'blocked', 'done'];
const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];
const labels: Record<Status, string> = { todo: 'To Do', 'in-progress': 'In Progress', blocked: 'Blocked', done: 'Done' };
const sprintLabels: Record<Sprint['status'], string> = { planned: 'Planned', active: 'Active', completed: 'Completed' };

function App() {
  const [data, setData] = useState<ProjectData | null>(null);
  const [view, setView] = useState<'board' | 'backlog' | 'sprints' | 'project'>('board');
  const [selected, setSelected] = useState<Story | null>(null);
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [selectedSprint, setSelectedSprint] = useState<string>('');
  const [modal, setModal] = useState<'story' | 'epic' | 'sprint' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    try { setError(''); setData(await api.project()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  if (loading) return <div className="center"><div className="spinner" />Loading Project Hub…</div>;
  if (error) return <div className="center error-state"><h2>Project Hub unavailable</h2><p>{error}</p><code>NEO_PROJECT_HUB=/path/to/project-docs npm run dev</code></div>;
  if (!data) return null;
  const refreshSelected = async () => {
    await load();
    const fresh = await api.project();
    if (selected) setSelected(fresh.stories.find(s => s.id === selected.id) || null);
    if (selectedEpic) setSelectedEpic(fresh.epics.find(e => e.id === selectedEpic.id) || null);
  };
  const navigate = (next: typeof view) => { setView(next); setSelectedSprint(''); };
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">N</div><div><strong>Neo Project Board</strong><span>{data.manifest.projectName}</span></div></div>
      <div className="top-actions"><button className="ghost" onClick={() => void load()}>Refresh</button><button className="ghost" onClick={() => setModal('epic')}>+ Epic</button><button className="primary" onClick={() => setModal('story')}>+ Story</button></div>
    </header>
    <div className="layout">
      <aside className="sidebar">
        <button className={view === 'board' ? 'nav active' : 'nav'} onClick={() => navigate('board')}>Board</button>
        <button className={view === 'backlog' ? 'nav active' : 'nav'} onClick={() => navigate('backlog')}>Backlog</button>
        <button className={view === 'sprints' ? 'nav active' : 'nav'} onClick={() => navigate('sprints')}>Sprints</button>
        <button className={view === 'project' ? 'nav active' : 'nav'} onClick={() => navigate('project')}>Project</button>
        <div className="sidebar-title">PROJECT</div><div className="project-name">{data.manifest.projectName}</div>
        <div className="stats"><div><b>{data.epics.length}</b><span>Epics</span></div><div><b>{data.stories.length}</b><span>Stories</span></div><div><b>{data.subtasks.length}</b><span>Tasks</span></div></div>
        <div className="sidebar-title">INSTALLED PACKS</div>{data.manifest.packs.length ? data.manifest.packs.map(p => <div className="pack" key={p.id}><span>{p.id}</span><small>{p.version}</small></div>) : <div className="pack empty-pack">None</div>}
        <div className="sidebar-footer"><span>Project Hub</span><code>{data.root}</code></div>
      </aside>
      <main className="content">
        {view === 'board' && <Board data={data} selectedSprint={selectedSprint} setSelectedSprint={setSelectedSprint} onSelect={setSelected} onRefresh={load} />}
        {view === 'backlog' && <Backlog data={data} onSelect={setSelected} onEpic={setSelectedEpic} onRefresh={load} />}
        {view === 'project' && <ProjectInfo data={data} />}
        {view === 'sprints' && <Sprints data={data} onSelect={setSelected} onRefresh={load} onCreate={() => setModal('sprint')} selectedSprint={selectedSprint} setSelectedSprint={setSelectedSprint} onBoard={() => setView('board')} />}
      </main>
    </div>
    {selected && <StoryDrawer story={selected} data={data} close={() => setSelected(null)} changed={refreshSelected} />}
    {selectedEpic && <EpicDrawer epic={selectedEpic} data={data} close={() => setSelectedEpic(null)} changed={refreshSelected} onStory={setSelected} />}
    {modal === 'epic' && <NewEpic onClose={() => setModal(null)} created={async () => { setModal(null); await load(); }} />}
    {modal === 'story' && <NewStory epics={data.epics} sprints={data.sprints} onClose={() => setModal(null)} created={async () => { setModal(null); await load(); }} />}
    {modal === 'sprint' && <NewSprint onClose={() => setModal(null)} created={async () => { setModal(null); await load(); }} />}
  </div>;
}

function ProjectInfo({ data }: { data: ProjectData }) {
  const active = data.sprints.find(s => s.status === 'active');
  const doneStories = data.stories.filter(s => s.status === 'done').length;
  const health = data.config?.hierarchy?.join(' → ') || 'epic → user-story → subtask';
  return <>
    <Heading title="Project" text="Project Hub identity and Neo Project Board integration status." />
    <div className="integration-grid">
      <section className="panel integration-card">
        <div className="eyebrow">PROJECT IDENTITY</div>
        <h2>{data.manifest.projectName}</h2>
        <div className="meta-line"><span>Project ID</span><code>{data.manifest.projectId}</code></div>
        <div className="meta-line"><span>Project Hub</span><code>{data.root}</code></div>
      </section>
      <section className="panel integration-card">
        <div className="eyebrow">BOARD INTEGRATION</div>
        <h2><span className="health-dot">●</span> Ready</h2>
        <div className="meta-line"><span>Board version</span><code>0.4.0</code></div>
        <div className="meta-line"><span>Source of truth</span><strong>Project Hub filesystem</strong></div>
        <div className="meta-line"><span>Runtime</span><strong>Local Node + React</strong></div>
      </section>
    </div>
    <div className="integration-grid">
      <section className="panel">
        <div className="section-heading"><h3>Project Hub contract</h3></div>
        <div className="contract-list">
          <div><span>Hierarchy</span><code>{health}</code></div>
          <div><span>Statuses</span><code>{data.config.statuses.join(', ')}</code></div>
          <div><span>Priorities</span><code>{data.config.priorities.join(', ')}</code></div>
          <div><span>Active Sprint</span><strong>{active?.name || 'None'}</strong></div>
        </div>
      </section>
      <section className="panel">
        <div className="section-heading"><h3>Project snapshot</h3></div>
        <div className="snapshot-grid">
          <div><b>{data.epics.length}</b><span>Epics</span></div>
          <div><b>{data.stories.length}</b><span>Stories</span></div>
          <div><b>{data.subtasks.length}</b><span>Subtasks</span></div>
          <div><b>{doneStories}</b><span>Done</span></div>
        </div>
      </section>
    </div>
    <section className="panel installed-panel">
      <div className="section-heading"><h3>Installed Packs</h3></div>
      {data.manifest.packs.length ? <div className="pack-grid">{data.manifest.packs.map(pack => <div className="pack-card" key={pack.id}><strong>{pack.id}</strong><span>v{pack.version}</span></div>)}</div> : <div className="empty">No packs registered in hub.json.</div>}
    </section>
  </>;
}

function Heading({ title, text, actions }: { title: string; text: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{text}</p></div><div className="heading-actions"><span className="source-pill">● Filesystem source of truth</span>{actions}</div></div>;
}

function Board({ data, selectedSprint, setSelectedSprint, onSelect, onRefresh }: { data: ProjectData; selectedSprint: string; setSelectedSprint: (v: string) => void; onSelect: (s: Story) => void; onRefresh: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const active = data.sprints.find(s => s.status === 'active');
  const sprint = data.sprints.find(s => s.id === selectedSprint);
  const targetSprint = selectedSprint || active?.id || '';
  const visible = useMemo(() => data.stories.filter(s => {
    const q = search.trim().toLowerCase();
    return (!q || s.id.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)) && (priority === 'all' || s.priority === priority) && (!targetSprint || s.sprintId === targetSprint);
  }), [data.stories, search, priority, targetSprint]);
  const move = async (story: Story, status: Status) => { if (story.status !== status) { await api.updateStory(story.id, { status }); await onRefresh(); } };
  const drop = async (e: React.DragEvent, status: Status) => { e.preventDefault(); const id = e.dataTransfer.getData('text/story'); const story = data.stories.find(s => s.id === id); if (story) await move(story, status); };
  return <>
    <Heading title={sprint ? sprint.name : active ? active.name : 'Sprint Board'} text="Move User Stories through the workflow and keep the filesystem in sync." actions={<select className="compact-select" value={targetSprint} onChange={e => setSelectedSprint(e.target.value)}><option value="">All Stories</option>{data.sprints.map(s => <option key={s.id} value={s.id}>{s.name} · {sprintLabels[s.status]}</option>)}</select>} />
    <div className="toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stories…" /><select value={priority} onChange={e => setPriority(e.target.value)}><option value="all">All priorities</option>{priorities.map(p => <option key={p}>{p}</option>)}</select><span>{visible.length} {visible.length === 1 ? 'story' : 'stories'}</span></div>
    <div className="board">{statuses.map(st => <section className="column" key={st} onDragOver={e => e.preventDefault()} onDrop={e => void drop(e, st)}><div className="column-header"><span>{labels[st]}</span><b>{visible.filter(s => s.status === st).length}</b></div><div className="cards">{visible.filter(s => s.status === st).map(s => <StoryCard key={s.id} story={s} epic={data.epics.find(e => e.id === s.epicId)} onClick={() => onSelect(s)} onDragStart={e => e.dataTransfer.setData('text/story', s.id)} />)}{!visible.filter(s => s.status === st).length && <div className="drop-hint">Drop stories here</div>}</div></section>)}</div>
  </>;
}

function StoryCard({ story, epic, onClick, onDragStart }: { story: Story; epic?: Epic; onClick: () => void; onDragStart: (e: React.DragEvent) => void }) {
  return <button className="story-card" draggable onDragStart={onDragStart} onClick={onClick}><div className="story-id">{story.id}</div><h3>{story.title}</h3>{epic && <div className="epic-label">{epic.title}</div>}<div className="card-footer"><span className={`priority ${story.priority}`}>{story.priority}</span><span>{story.subtasks.length} task{story.subtasks.length === 1 ? '' : 's'}</span><span>{story.comments.length} 💬</span></div></button>;
}

function Backlog({ data, onSelect, onEpic, onRefresh }: { data: ProjectData; onSelect: (s: Story) => void; onEpic: (e: Epic) => void; onRefresh: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const matches = (s: Story) => { const q = search.toLowerCase().trim(); return (!q || s.id.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)) && (priority === 'all' || s.priority === priority); };
  return <><Heading title="Backlog" text="Organize Epics, User Stories and their hierarchy." actions={<button className="ghost" onClick={() => void onRefresh()}>Refresh</button>} /><div className="toolbar"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search backlog…" /><select value={priority} onChange={e => setPriority(e.target.value)}><option value="all">All priorities</option>{priorities.map(p => <option key={p}>{p}</option>)}</select></div><div className="backlog-list">{data.epics.map(e => { const stories = data.stories.filter(s => s.epicId === e.id && matches(s)); const isOpen = expanded[e.id] ?? true; return <div className="backlog-epic" key={e.id}><div className="backlog-epic-title"><button className="expand-btn" onClick={() => setExpanded(x => ({ ...x, [e.id]: !isOpen }))}>{isOpen ? '▾' : '▸'}</button><button className="epic-main" onClick={() => onEpic(e)}><div><small>{e.id}</small><h2>{e.title}</h2></div><span className={`priority ${e.priority}`}>{e.priority}</span></button></div>{isOpen && stories.map(s => <BacklogRow key={s.id} story={s} data={data} onClick={() => onSelect(s)} />)}{isOpen && !stories.length && <div className="empty indent">No matching stories.</div>}</div>; })}{data.stories.filter(s => !s.epicId && matches(s)).map(s => <BacklogRow key={s.id} story={s} data={data} onClick={() => onSelect(s)} />)}{!data.epics.length && !data.stories.length && <div className="empty">No backlog items yet.</div>}</div></>;
}

function BacklogRow({ story, data, onClick }: { story: Story; data: ProjectData; onClick: () => void }) { const sprint = data.sprints.find(s => s.id === story.sprintId); return <button className="backlog-row" onClick={onClick}><span className="row-id">{story.id}</span><strong>{story.title}</strong><span className={`status ${story.status}`}>{labels[story.status]}</span><span className={`priority ${story.priority}`}>{story.priority}</span><span>{sprint?.name || 'Backlog'}</span><span>{story.subtasks.length} tasks</span></button>; }

function Sprints({ data, onSelect, onRefresh, onCreate, selectedSprint, setSelectedSprint, onBoard }: { data: ProjectData; onSelect: (s: Story) => void; onRefresh: () => Promise<void>; onCreate: () => void; selectedSprint: string; setSelectedSprint: (v: string) => void; onBoard: () => void }) {
  return <><Heading title="Sprints" text="Plan iterations, assign stories and track progress." actions={<button className="primary" onClick={onCreate}>+ New Sprint</button>} /><div className="sprint-list">{data.sprints.map(s => <SprintCard key={s.id} sprint={s} data={data} onSelect={onSelect} onRefresh={onRefresh} onOpenBoard={() => { setSelectedSprint(s.id); onBoard(); }} />)}{!data.sprints.length && <div className="empty panel">No sprints yet. Create your first sprint.</div>}</div></>;
}

function SprintCard({ sprint, data, onSelect, onRefresh, onOpenBoard }: { sprint: Sprint; data: ProjectData; onSelect: (s: Story) => void; onRefresh: () => Promise<void>; onOpenBoard: () => void }) {
  const stories = data.stories.filter(s => sprint.storyIds.includes(s.id)); const done = stories.filter(s => s.status === 'done').length; const progress = stories.length ? Math.round(done / stories.length * 100) : 0;
  const setStatus = async (status: Sprint['status']) => { await api.updateSprint(sprint.id, { status }); await onRefresh(); };
  const remove = async () => { if (confirm(`Delete ${sprint.name}? Stories will return to the backlog.`)) { await api.deleteSprint(sprint.id); await onRefresh(); } };
  return <section className="sprint-card"><div className="sprint-top"><div><span className={`sprint-state ${sprint.status}`}>{sprintLabels[sprint.status]}</span><h2>{sprint.name}</h2><p>{sprint.goal || 'No sprint goal.'}</p><small>{sprint.startDate || '—'} → {sprint.endDate || '—'}</small></div><div className="sprint-actions">{sprint.status === 'planned' && <button className="ghost" onClick={() => void setStatus('active')}>Start</button>}{sprint.status === 'active' && <button className="ghost" onClick={() => void setStatus('completed')}>Complete</button>}{sprint.status !== 'completed' && <button className="danger" onClick={() => void remove()}>Delete</button>}<button className="ghost" onClick={onOpenBoard}>Open Board</button></div></div><div className="progress-row"><span>Progress</span><div className="progress"><i style={{ width: `${progress}%` }} /></div><b>{progress}%</b><span>{done}/{stories.length} done</span></div><div className="sprint-stories">{stories.length ? stories.map(s => <button key={s.id} className="backlog-row" onClick={() => onSelect(s)}><span className="row-id">{s.id}</span><strong>{s.title}</strong><span className={`status ${s.status}`}>{labels[s.status]}</span><span className={`priority ${s.priority}`}>{s.priority}</span></button>) : <div className="empty">No stories assigned.</div>}</div></section>;
}

function StoryDrawer({ story, data, close, changed }: { story: Story; data: ProjectData; close: () => void; changed: () => Promise<void> }) {
  const [comment, setComment] = useState(''); const [author, setAuthor] = useState('local-user'); const [title, setTitle] = useState(story.title); const [description, setDescription] = useState(story.description); const [criteria, setCriteria] = useState(story.acceptanceCriteria.join('\n')); const [saving, setSaving] = useState(false); const [task, setTask] = useState('');
  const tasks = data.subtasks.filter(t => t.storyId === story.id);
  useEffect(() => { setTitle(story.title); setDescription(story.description); setCriteria(story.acceptanceCriteria.join('\n')); }, [story]);
  const save = async (p: Partial<Story>) => { setSaving(true); try { await api.updateStory(story.id, p); await changed(); } finally { setSaving(false); } };
  const addComment = async () => { if (!comment.trim()) return; setSaving(true); try { await api.addComment(story.id, { author: author || 'local-user', content: comment.trim() }); setComment(''); await changed(); } finally { setSaving(false); } };
  const addTask = async () => { if (!task.trim()) return; setSaving(true); try { await api.createSubtask(story.id, { title: task.trim(), status: 'todo', completed: false }); setTask(''); await changed(); } finally { setSaving(false); } };
  const del = async () => { if (confirm(`Delete ${story.id} — ${story.title}?\n\nThis deletes the story and its subtasks.`)) { setSaving(true); try { await api.deleteStory(story.id); close(); await changed(); } finally { setSaving(false); } } };
  const sprint = data.sprints.find(s => s.id === story.sprintId);
  return <div className="overlay"><aside className="drawer"><div className="drawer-head"><div><span className="story-id">{story.id}</span><h2>{story.title}</h2></div><button className="icon-btn" onClick={close}>×</button></div><div className="drawer-scroll">
    <div className="field-grid"><label>Status<select value={story.status} onChange={e => void save({ status: e.target.value as Status })}>{statuses.map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label><label>Priority<select value={story.priority} onChange={e => void save({ priority: e.target.value as Priority })}>{priorities.map(p => <option key={p}>{p}</option>)}</select></label><label>Sprint<select value={story.sprintId || ''} onChange={e => void save({ sprintId: e.target.value || undefined })}><option value="">Backlog</option>{data.sprints.filter(s => s.status !== 'completed').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
    <label className="block-field">Title<input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title !== story.title && void save({ title })} /></label>
    <label className="block-field">Description<textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => description !== story.description && void save({ description })} /></label>
    <label className="block-field">Acceptance Criteria<textarea value={criteria} onChange={e => setCriteria(e.target.value)} onBlur={() => void save({ acceptanceCriteria: criteria.split('\n').map(x => x.trim()).filter(Boolean) })} placeholder="One criterion per line" /></label>
    <div className="comments"><div className="section-heading"><h3>Subtasks</h3><span>{tasks.filter(t => t.completed).length}/{tasks.length}</span></div>{tasks.map(t => <TaskRow key={t.id} task={t} changed={changed} />)}<div className="inline-add"><input value={task} onChange={e => setTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addTask(); }} placeholder="Add a subtask…" /><button className="ghost" onClick={() => void addTask()}>Add</button></div></div>
    <div className="comments"><div className="section-heading"><h3>Discussion</h3><span>{story.comments.length}</span></div>{story.comments.map(c => <div className="comment" key={c.id}><div className="comment-meta"><strong>{c.author}</strong><time>{new Date(c.createdAt).toLocaleString()}</time></div><p>{c.content}</p></div>)}{!story.comments.length && <div className="empty">No discussion yet.</div>}<div className="comment-compose"><input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Your name" /><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a discussion comment…" /><button className="primary" disabled={saving || !comment.trim()} onClick={() => void addComment()}>Comment</button></div></div>
    <div className="danger-zone"><button className="danger" disabled={saving} onClick={() => void del()}>Delete User Story</button><span>Deletes this story and its subtasks.</span></div>
  </div>{saving && <div className="saving">Saving…</div>}</aside></div>;
}

function TaskRow({ task, changed }: { task: Subtask; changed: () => Promise<void> }) { const toggle = async () => { await api.updateSubtask(task.id, { completed: !task.completed, status: !task.completed ? 'done' : 'todo' }); await changed(); }; const del = async () => { if (confirm(`Delete ${task.title}?`)) { await api.deleteSubtask(task.id); await changed(); } }; return <div className="task-row"><input type="checkbox" checked={task.completed} onChange={() => void toggle()} /><span className={task.completed ? 'completed' : ''}>{task.title}</span><button className="icon-small" onClick={() => void del()}>×</button></div>; }

function EpicDrawer({ epic, data, close, changed, onStory }: { epic: Epic; data: ProjectData; close: () => void; changed: () => Promise<void>; onStory: (s: Story) => void }) { const [title, setTitle] = useState(epic.title); const [description, setDescription] = useState(epic.description || ''); const stories = data.stories.filter(s => s.epicId === epic.id); const save = async (p: Partial<Epic>) => { await api.updateEpic(epic.id, p); await changed(); }; const del = async () => { if (stories.length) return alert('Delete or move all User Stories in this Epic first.'); if (confirm(`Delete ${epic.title}?`)) { await api.deleteEpic(epic.id); close(); await changed(); } }; return <div className="overlay"><aside className="drawer"><div className="drawer-head"><div><span className="story-id">{epic.id}</span><h2>{epic.title}</h2></div><button className="icon-btn" onClick={close}>×</button></div><div className="drawer-scroll"><label className="block-field">Title<input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => title !== epic.title && void save({ title })} /></label><label className="block-field">Description<textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => description !== (epic.description || '') && void save({ description })} /></label><div className="field-grid"><label>Status<select value={epic.status} onChange={e => void save({ status: e.target.value as Status })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Priority<select value={epic.priority} onChange={e => void save({ priority: e.target.value as Priority })}>{priorities.map(p => <option key={p}>{p}</option>)}</select></label><div /></div><div className="comments"><div className="section-heading"><h3>User Stories</h3><span>{stories.length}</span></div>{stories.map(s => <button className="simple-row story-link" key={s.id} onClick={() => { close(); onStory(s); }}><span>{s.id}</span><strong>{s.title}</strong><span className={`status ${s.status}`}>{labels[s.status]}</span></button>)}{!stories.length && <div className="empty">No stories in this Epic.</div>}</div><div className="danger-zone"><button className="danger" disabled={stories.length > 0} onClick={() => void del()}>Delete Epic</button><span>{stories.length ? 'Move/delete stories first.' : 'Permanent deletion.'}</span></div></div></aside></div>; }

function NewEpic({ onClose, created }: { onClose: () => void; created: () => Promise<void> }) { const [t, setT] = useState(''), [d, setD] = useState(''), [p, setP] = useState<Priority>('medium'), [saving, setSaving] = useState(false); const go = async () => { if (!t.trim()) return; setSaving(true); try { await api.createEpic({ title: t.trim(), description: d.trim(), status: 'todo', priority: p, userStories: [], comments: [] }); await created(); } finally { setSaving(false); } }; return <Modal title="New Epic" close={onClose}><label className="block-field">Title<input autoFocus value={t} onChange={e => setT(e.target.value)} placeholder="Epic title" /></label><label className="block-field">Description<textarea value={d} onChange={e => setD(e.target.value)} /></label><label>Priority<select value={p} onChange={e => setP(e.target.value as Priority)}>{priorities.map(x => <option key={x}>{x}</option>)}</select></label><Actions close={onClose} save={go} saving={saving} text="Create Epic" /></Modal>; }
function NewStory({ epics, sprints, onClose, created }: { epics: Epic[]; sprints: Sprint[]; onClose: () => void; created: () => Promise<void> }) { const [t, setT] = useState(''), [d, setD] = useState(''), [e, setE] = useState(''), [sp, setSp] = useState(''), [p, setP] = useState<Priority>('medium'), [saving, setSaving] = useState(false); const go = async () => { if (!t.trim()) return; setSaving(true); try { await api.createStory({ title: t.trim(), description: d, epicId: e || undefined, sprintId: sp || undefined, priority: p, status: 'todo', acceptanceCriteria: [], subtasks: [], comments: [] }); await created(); } finally { setSaving(false); } }; return <Modal title="New User Story" close={onClose}><label className="block-field">Title<input autoFocus value={t} onChange={e => setT(e.target.value)} placeholder="As a user, I want…" /></label><label className="block-field">Description<textarea value={d} onChange={e => setD(e.target.value)} /></label><div className="field-grid"><label>Epic<select value={e} onChange={x => setE(x.target.value)}><option value="">No epic</option>{epics.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label><label>Sprint<select value={sp} onChange={x => setSp(x.target.value)}><option value="">Backlog</option>{sprints.filter(s => s.status !== 'completed').map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Priority<select value={p} onChange={x => setP(x.target.value as Priority)}>{priorities.map(x => <option key={x}>{x}</option>)}</select></label></div><Actions close={onClose} save={go} saving={saving} text="Create Story" /></Modal>; }
function NewSprint({ onClose, created }: { onClose: () => void; created: () => Promise<void> }) { const [n, setN] = useState('Sprint 1'), [g, setG] = useState(''), [s, setS] = useState(''), [e, setE] = useState(''), [saving, setSaving] = useState(false); const go = async () => { if (!n.trim()) return; setSaving(true); try { await api.createSprint({ name: n.trim(), goal: g, startDate: s, endDate: e, status: 'planned', storyIds: [] }); await created(); } finally { setSaving(false); } }; return <Modal title="New Sprint" close={onClose}><label className="block-field">Name<input autoFocus value={n} onChange={x => setN(x.target.value)} /></label><label className="block-field">Goal<textarea value={g} onChange={x => setG(x.target.value)} /></label><div className="field-grid"><label>Start<input type="date" value={s} onChange={x => setS(x.target.value)} /></label><label>End<input type="date" value={e} onChange={x => setE(x.target.value)} /></label><div /></div><Actions close={onClose} save={go} saving={saving} text="Create Sprint" /></Modal>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="overlay"><div className="modal"><div className="drawer-head"><div><span className="eyebrow">PROJECT MANAGEMENT</span><h2>{title}</h2></div><button className="icon-btn" onClick={close}>×</button></div>{children}</div></div>; }
function Actions({ close, save, saving, text }: { close: () => void; save: () => void; saving: boolean; text: string }) { return <div className="modal-actions"><button className="ghost" onClick={close}>Cancel</button><button className="primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : text}</button></div>; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
