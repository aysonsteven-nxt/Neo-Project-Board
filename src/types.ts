export type Status = 'todo' | 'in-progress' | 'blocked' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Comment { id: string; author: string; content: string; createdAt: string; updatedAt?: string; }
export interface Epic { id: string; title: string; description?: string; status: Status; priority: Priority; userStories: string[]; comments?: Comment[]; createdAt?: string; updatedAt?: string; }
export interface Story { id: string; epicId?: string; sprintId?: string; title: string; description: string; acceptanceCriteria: string[]; status: Status; priority: Priority; subtasks: string[]; comments: Comment[]; createdAt?: string; updatedAt?: string; }
export interface Subtask { id: string; storyId: string; title: string; description?: string; status: Status; completed: boolean; comments?: Comment[]; createdAt?: string; updatedAt?: string; }
export interface Sprint { id: string; name: string; goal?: string; startDate: string; endDate: string; status: 'planned' | 'active' | 'completed'; storyIds: string[]; createdAt: string; updatedAt: string; }
export interface ProjectData { root: string; manifest: { projectId: string; projectName: string; packs: { id: string; version: string }[] }; config: { statuses: string[]; priorities: string[]; hierarchy: string[] }; epics: Epic[]; stories: Story[]; subtasks: Subtask[]; sprints: Sprint[]; }
