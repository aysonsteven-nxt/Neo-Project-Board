import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const STATUSES = ['todo', 'in-progress', 'blocked', 'done'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

type JsonObject = Record<string, unknown>;

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJson(file: string): JsonObject {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as JsonObject;
}

function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function projectHubRoot() {
  const configured = process.env.NEO_PROJECT_HUB;
  return path.resolve(configured || path.resolve(process.cwd(), '..'));
}

function collectJson(dir: string): Array<{ file: string; data: JsonObject }> {
  if (!fs.existsSync(dir)) return [];
  const out: Array<{ file: string; data: JsonObject }> = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJson(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      try { out.push({ file: full, data: readJson(full) }); } catch { /* ignore malformed files */ }
    }
  }
  return out;
}

function boardPlugin(): Plugin {
  return {
    name: 'neo-project-board-local-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        try {
          const root = projectHubRoot();
          const hub = path.join(root, 'hub.json');
          const board = path.join(root, 'board', 'board.json');
          if (!fs.existsSync(hub)) return json(res, 404, { error: `Project Hub not found: ${root}` });

          const url = new URL(req.url || '/', 'http://localhost');
          const pathname = url.pathname;

          if (req.method === 'GET' && pathname === '/health') {
            const hubExists = fs.existsSync(hub);
            const boardExists = fs.existsSync(board);
            return json(res, 200, {
              status: hubExists && boardExists ? 'ready' : 'incomplete',
              boardVersion: '0.4.0',
              projectHub: root,
              hubExists,
              boardConfigExists: boardExists,
              expectedLayout: '<project>-docs/neo-project-board'
            });
          }

          if (req.method === 'GET' && pathname === '/metadata') {
            if (!fs.existsSync(hub)) return json(res, 404, { error: `Project Hub not found: ${root}` });
            const manifest = readJson(hub);
            return json(res, 200, {
              app: 'neo-project-board',
              name: 'Neo Project Board',
              version: '0.4.0',
              contract: 'neo-orchestrax/project-board@1',
              projectId: manifest.projectId,
              projectName: manifest.projectName,
              projectHub: root,
              projectBoardPath: path.join(root, 'neo-project-board')
            });
          }

          if (req.method === 'GET' && pathname === '/project') {
            const manifest = readJson(hub);
            const config = fs.existsSync(board) ? readJson(board) : {
              statuses: [...STATUSES], priorities: [...PRIORITIES], hierarchy: ['epic', 'user-story', 'subtask']
            };
            const epics = collectJson(path.join(root, 'board', 'epics')).map(x => ({ ...x.data, _file: x.file }));
            const stories = collectJson(path.join(root, 'board', 'stories')).map(x => ({ ...x.data, _file: x.file }));
            const subtasks = collectJson(path.join(root, 'board', 'subtasks')).map(x => ({ ...x.data, _file: x.file }));
            const sprints = collectJson(path.join(root, 'board', 'sprints')).map(x => ({ ...x.data, _file: x.file }));
            return json(res, 200, { root, manifest, config, epics, stories, subtasks, sprints });
          }

          const body = async (): Promise<JsonObject> => new Promise((resolve, reject) => {
            let raw = '';
            req.on('data', chunk => raw += chunk);
            req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
            req.on('error', reject);
          });

          const findFile = (kind: 'stories' | 'epics' | 'subtasks' | 'sprints', itemId: string) => {
            const files = collectJson(path.join(root, 'board', kind));
            return files.find(x => x.data.id === itemId)?.file;
          };

          if (req.method === 'POST' && pathname === '/stories') {
            const b = await body();
            const now = new Date().toISOString();
            const story = {
              id: id('US'),
              epicId: typeof b.epicId === 'string' ? b.epicId : undefined,
              title: String(b.title || 'Untitled user story'),
              description: String(b.description || ''),
              acceptanceCriteria: Array.isArray(b.acceptanceCriteria) ? b.acceptanceCriteria.map(String) : [],
              status: STATUSES.includes(b.status as any) ? b.status : 'todo',
              priority: PRIORITIES.includes(b.priority as any) ? b.priority : 'medium',
              subtasks: [],
              comments: [],
              createdAt: now,
              updatedAt: now
            };
            const safe = JSON.parse(JSON.stringify(story));
            const file = path.join(root, 'board', 'stories', `${story.id}.json`);
            writeJson(file, safe);
            if (story.epicId) {
              const epicFile = findFile('epics', story.epicId);
              if (epicFile) {
                const epic = readJson(epicFile);
                const ids = Array.isArray(epic.userStories) ? epic.userStories.map(String) : [];
                if (!ids.includes(story.id)) ids.push(story.id);
                epic.userStories = ids;
                epic.updatedAt = now;
                writeJson(epicFile, epic);
              }
            }
            return json(res, 201, safe);
          }

          const storyMatch = pathname.match(/^\/stories\/([^/]+)$/);
          if (storyMatch && req.method === 'DELETE') {
            const storyId = storyMatch[1];
            const file = findFile('stories', storyId);
            if (!file) return json(res, 404, { error: 'Story not found' });
            const story = readJson(file);
            const epicId = typeof story.epicId === 'string' ? story.epicId : undefined;
            const sprintId = typeof story.sprintId === 'string' ? story.sprintId : undefined;
            const subtasks = Array.isArray(story.subtasks) ? story.subtasks.map(String) : [];

            // Remove the story from its Epic's relationship list.
            if (epicId) {
              const epicFile = findFile('epics', epicId);
              if (epicFile) {
                const epic = readJson(epicFile);
                epic.userStories = Array.isArray(epic.userStories)
                  ? epic.userStories.map(String).filter(id => id !== storyId)
                  : [];
                epic.updatedAt = new Date().toISOString();
                writeJson(epicFile, epic);
              }
            }

            if (sprintId) {
              const sprintFile = findFile('sprints', sprintId);
              if (sprintFile) {
                const sprint = readJson(sprintFile);
                sprint.storyIds = Array.isArray(sprint.storyIds) ? sprint.storyIds.map(String).filter(id => id !== storyId) : [];
                sprint.updatedAt = new Date().toISOString();
                writeJson(sprintFile, sprint);
              }
            }

            // A User Story owns its Subtasks, so deletion cascades to their JSON files.
            // Prefer the story's relationship list, but also scan by storyId so stale
            // relationship metadata cannot leave orphaned subtask files behind.
            const subtaskFiles = collectJson(path.join(root, 'board', 'subtasks'));
            for (const subtask of subtaskFiles) {
              const subtaskId = typeof subtask.data.id === 'string' ? subtask.data.id : '';
              const belongsToStory = subtask.data.storyId === storyId || subtasks.includes(subtaskId);
              if (belongsToStory) fs.unlinkSync(subtask.file);
            }

            fs.unlinkSync(file);
            return json(res, 200, { ok: true });
          }

          if (storyMatch && req.method === 'PATCH') {
            const file = findFile('stories', storyMatch[1]);
            if (!file) return json(res, 404, { error: 'Story not found' });
            const patch = await body();
            const story = readJson(file);
            const oldEpicId = typeof story.epicId === 'string' ? story.epicId : '';
            const oldSprintId = typeof story.sprintId === 'string' ? story.sprintId : '';
            for (const key of ['title', 'description', 'status', 'priority', 'epicId', 'acceptanceCriteria', 'subtasks', 'sprintId']) {
              if (key in patch) story[key] = patch[key];
            }
            const newEpicId = typeof story.epicId === 'string' ? story.epicId : '';
            if (oldEpicId !== newEpicId) {
              for (const epicFile of collectJson(path.join(root,'board','epics'))) {
                const epic=epicFile.data; if (!Array.isArray(epic.userStories)) continue;
                epic.userStories=epic.userStories.map(String).filter(x=>x!==story.id);
                if (epic.id===newEpicId) epic.userStories.push(story.id);
                epic.updatedAt=new Date().toISOString(); writeJson(epicFile.file,epic);
              }
            }
            const newSprintId = typeof story.sprintId === 'string' ? story.sprintId : '';
            if (oldSprintId !== newSprintId) {
              for (const sprintFile of collectJson(path.join(root,'board','sprints'))) {
                const sprint=sprintFile.data; if (!Array.isArray(sprint.storyIds)) sprint.storyIds=[];
                sprint.storyIds=sprint.storyIds.map(String).filter(x=>x!==story.id);
                if (sprint.id===newSprintId) sprint.storyIds.push(story.id);
                sprint.updatedAt=new Date().toISOString(); writeJson(sprintFile.file,sprint);
              }
            }
            story.updatedAt = new Date().toISOString();
            writeJson(file, story);
            return json(res, 200, story);
          }

          const commentsMatch = pathname.match(/^\/stories\/([^/]+)\/comments$/);
          if (commentsMatch && req.method === 'POST') {
            const file = findFile('stories', commentsMatch[1]);
            if (!file) return json(res, 404, { error: 'Story not found' });
            const b = await body();
            const story = readJson(file);
            const comments = Array.isArray(story.comments) ? story.comments : [];
            const comment = {
              id: id('comment'),
              author: String(b.author || 'local-user'),
              content: String(b.content || ''),
              createdAt: new Date().toISOString()
            };
            comments.push(comment);
            story.comments = comments;
            story.updatedAt = new Date().toISOString();
            writeJson(file, story);
            return json(res, 201, comment);
          }

          if (req.method === 'POST' && pathname === '/epics') {
            const b = await body();
            const now = new Date().toISOString();
            const epic = {
              id: id('EPIC'),
              title: String(b.title || 'Untitled epic'),
              description: String(b.description || ''),
              status: STATUSES.includes(b.status as any) ? b.status : 'todo',
              priority: PRIORITIES.includes(b.priority as any) ? b.priority : 'medium',
              userStories: [],
              comments: [],
              createdAt: now,
              updatedAt: now
            };
            const file = path.join(root, 'board', 'epics', `${epic.id}.json`);
            writeJson(file, epic);
            return json(res, 201, epic);
          }


          const epicMatch = pathname.match(/^\/epics\/([^/]+)$/);
          if (epicMatch && req.method === 'PATCH') {
            const file = findFile('epics', epicMatch[1]); if (!file) return json(res,404,{error:'Epic not found'});
            const patch = await body(); const epic = readJson(file);
            for (const key of ['title','description','status','priority']) if (key in patch) epic[key] = patch[key];
            epic.updatedAt = new Date().toISOString(); writeJson(file, epic); return json(res,200,epic);
          }
          if (epicMatch && req.method === 'DELETE') {
            const file = findFile('epics', epicMatch[1]); if (!file) return json(res,404,{error:'Epic not found'});
            const epic = readJson(file); const ids = Array.isArray(epic.userStories) ? epic.userStories.map(String) : [];
            if (ids.length) return json(res,409,{error:'Epic still contains User Stories. Move or delete them first.'});
            fs.unlinkSync(file); return json(res,200,{ok:true});
          }

          const subtaskCreate = pathname.match(/^\/stories\/([^/]+)\/subtasks$/);
          if (subtaskCreate && req.method === 'POST') {
            const storyFile = findFile('stories', subtaskCreate[1]); if (!storyFile) return json(res,404,{error:'Story not found'});
            const b = await body(); const now = new Date().toISOString();
            const subtask = { id:id('TASK'), storyId:subtaskCreate[1], title:String(b.title||'Untitled task'), description:String(b.description||''), status:STATUSES.includes(b.status as any)?b.status:'todo', completed:Boolean(b.completed||false), comments:[], createdAt:now, updatedAt:now };
            writeJson(path.join(root,'board','subtasks',`${subtask.id}.json`),subtask);
            const story=readJson(storyFile); const ids=Array.isArray(story.subtasks)?story.subtasks.map(String):[]; ids.push(subtask.id); story.subtasks=ids; story.updatedAt=now; writeJson(storyFile,story);
            return json(res,201,subtask);
          }
          const subtaskMatch = pathname.match(/^\/subtasks\/([^/]+)$/);
          if (subtaskMatch && req.method === 'PATCH') {
            const file=findFile('subtasks',subtaskMatch[1]); if(!file) return json(res,404,{error:'Subtask not found'});
            const patch=await body(); const task=readJson(file); for(const key of ['title','description','status','completed']) if(key in patch) task[key]=patch[key]; task.updatedAt=new Date().toISOString(); writeJson(file,task); return json(res,200,task);
          }
          if (subtaskMatch && req.method === 'DELETE') {
            const file=findFile('subtasks',subtaskMatch[1]); if(!file) return json(res,404,{error:'Subtask not found'});
            const task=readJson(file); const storyId=String(task.storyId||''); const storyFile=findFile('stories',storyId);
            if(storyFile){const story=readJson(storyFile); story.subtasks=Array.isArray(story.subtasks)?story.subtasks.map(String).filter(x=>x!==subtaskMatch[1]):[]; story.updatedAt=new Date().toISOString(); writeJson(storyFile,story);} fs.unlinkSync(file); return json(res,200,{ok:true});
          }

          if (req.method === 'POST' && pathname === '/sprints') {
            const b=await body(); const now=new Date().toISOString(); const sprint={id:id('SPRINT'),name:String(b.name||'New Sprint'),goal:String(b.goal||''),startDate:String(b.startDate||''),endDate:String(b.endDate||''),status:(['planned','active','completed'].includes(String(b.status))?String(b.status):'planned'),storyIds:Array.isArray(b.storyIds)?b.storyIds.map(String):[],createdAt:now,updatedAt:now};
            if(sprint.status==='active'){for(const x of collectJson(path.join(root,'board','sprints'))){if(x.data.status==='active'){x.data.status='planned';x.data.updatedAt=now;writeJson(x.file,x.data);}}}
            writeJson(path.join(root,'board','sprints',`${sprint.id}.json`),sprint); return json(res,201,sprint);
          }
          const sprintMatch=pathname.match(/^\/sprints\/([^/]+)$/);
          if(sprintMatch && req.method==='PATCH'){
            const file=findFile('sprints',sprintMatch[1]); if(!file)return json(res,404,{error:'Sprint not found'}); const patch=await body(); const sprint=readJson(file);
            for(const key of ['name','goal','startDate','endDate','status','storyIds']) if(key in patch) sprint[key]=patch[key]; const now=new Date().toISOString(); sprint.updatedAt=now;
            if(sprint.status==='active'){for(const x of collectJson(path.join(root,'board','sprints'))){if(x.data.id!==sprint.id && x.data.status==='active'){x.data.status='planned';x.data.updatedAt=now;writeJson(x.file,x.data);}}}
            writeJson(file,sprint); return json(res,200,sprint);
          }
          if(sprintMatch && req.method==='DELETE'){const file=findFile('sprints',sprintMatch[1]);if(!file)return json(res,404,{error:'Sprint not found'});const sprint=readJson(file);const ids=Array.isArray(sprint.storyIds)?sprint.storyIds.map(String):[];for(const sf of collectJson(path.join(root,'board','stories'))){if(ids.includes(String(sf.data.id))){sf.data.sprintId=undefined;sf.data.updatedAt=new Date().toISOString();writeJson(sf.file,sf.data);}}fs.unlinkSync(file);return json(res,200,{ok:true});}

          return json(res, 404, { error: 'Not found' });
        } catch (error) {
          return json(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), boardPlugin()],
  server: { host: '127.0.0.1', port: 4173 }
});
