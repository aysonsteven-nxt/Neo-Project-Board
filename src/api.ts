import type { ProjectData, Story, Epic, Comment, Subtask, Sprint } from './types';
async function request<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init }); const data = await response.json(); if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`); return data; }
export const api = {
 project: () => request<ProjectData>('/api/project'),
 createStory: (payload: Partial<Story>) => request<Story>('/api/stories', { method:'POST', body:JSON.stringify(payload) }),
 updateStory: (id:string,payload:Partial<Story>) => request<Story>(`/api/stories/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)}),
 deleteStory: (id:string) => request<{ok:true}>(`/api/stories/${encodeURIComponent(id)}`,{method:'DELETE'}),
 addComment: (id:string,payload:Pick<Comment,'author'|'content'>) => request<Comment>(`/api/stories/${encodeURIComponent(id)}/comments`,{method:'POST',body:JSON.stringify(payload)}),
 createEpic: (payload:Partial<Epic>) => request<Epic>('/api/epics',{method:'POST',body:JSON.stringify(payload)}),
 updateEpic: (id:string,payload:Partial<Epic>) => request<Epic>(`/api/epics/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)}),
 deleteEpic: (id:string) => request<{ok:true}>(`/api/epics/${encodeURIComponent(id)}`,{method:'DELETE'}),
 createSubtask: (storyId:string,payload:Partial<Subtask>) => request<Subtask>(`/api/stories/${encodeURIComponent(storyId)}/subtasks`,{method:'POST',body:JSON.stringify(payload)}),
 updateSubtask: (id:string,payload:Partial<Subtask>) => request<Subtask>(`/api/subtasks/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)}),
 deleteSubtask: (id:string) => request<{ok:true}>(`/api/subtasks/${encodeURIComponent(id)}`,{method:'DELETE'}),
 createSprint: (payload:Partial<Sprint>) => request<Sprint>('/api/sprints',{method:'POST',body:JSON.stringify(payload)}),
 updateSprint: (id:string,payload:Partial<Sprint>) => request<Sprint>(`/api/sprints/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)}),
 deleteSprint: (id:string) => request<{ok:true}>(`/api/sprints/${encodeURIComponent(id)}`,{method:'DELETE'})
};
