import {markInput,readRoster,saveMark} from '../shared/lib/attendance';
import { z, ZodError } from 'zod';
import { Database, userColumns } from './db';
import { ensureSeed } from './seed';
import { domain } from './domain';
import { login, logout, csrfResponse, identity, mutation, rateLimit as limit } from './auth';
import { requireStaff, requireStudent, fail, HttpError, respond, readBytes, json } from './support';
import { documentData, makePdf, qrPng } from './documents';
const idSchema = z.string().min(1).max(100);
const statuses = ['created', 'accepted', 'processing', 'clarification', 'ready', 'rejected'];
let initialized;
export async function api(req, env) {
    let result;
    try {
        const db = new Database(env.DB);
        initialized ??= ensureSeed(db).catch(error => { initialized = undefined; throw error; });
        await initialized;
        result = await dispatch(req, db);
    }
    catch (e) {
        if (e instanceof HttpError)
            result = respond({ error: e.code }, e.status);
        else if (e instanceof ZodError)
            result = respond({ error: 'invalid_input' }, 422);
        else {
            console.error('Campus API error', e instanceof Error ? e.message : 'unknown');
            result = respond({ error: 'server_error' }, 500);
        }
    }
    result.headers.set('Cache-Control', 'private, no-store');
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('Referrer-Policy','no-referrer');
    result.headers.set('X-Frame-Options','DENY');
    result.headers.set('Cross-Origin-Resource-Policy','same-origin');
    result.headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; sandbox");
    return result;
}
async function dispatch(req, db) {
    const d = domain(db), url = new URL(req.url), path = url.pathname.slice(5).split('/'), [section, id, action] = path, method = req.method;
    if (path.length > 3)
        fail(404, 'not_found');
    if (section === 'auth' && path.length === 1) {
        if (method === 'GET')
            return csrfResponse(req);
        if (method === 'POST') {
            const body = z.object({ login: z.string().max(60).optional(), password: z.string().max(128).optional(), demo: z.enum(['alex','vera']).optional() }).strict().parse(await json(req));
            return await login(req, db, body);
        }
        if (method === 'DELETE')
            return logout(req, db);
    }
    if (section === 'verify' && id && method === 'GET') {
        const entry = await db.one('SELECT number,status,updated_at FROM requests WHERE verification=? AND status=? AND delivery=?', id, 'ready', 'digital');
        if (!entry)
            fail(404, 'not_found');
        return respond({ valid: true, number: entry.number, updated_at: entry.updated_at, demo: true });
    }
    const { user, csrf } = await identity(req, db);
    if (!['GET', 'HEAD'].includes(method))
        mutation(req, csrf);
    if (id)
        idSchema.parse(id);
    if (section === 'me' && !id && method === 'GET')
        return respond(await d.bootstrap(user, csrf));
    if(section==='attendance'&&id&&!action){
   if(user.role!=='teacher')fail(403,'forbidden');
   if(method==='GET'){
     const rows=await db.all(readRoster,id,user.id);
     if(!rows.length)fail(404,'not_found');
     return respond(rows);
   }
   if(method==='PATCH'){
     const mark=markInput.parse(await json(req));
     const result=await db.run(saveMark,mark.status,id,user.id,mark.member);
     if(!result.changes)fail(404,'not_found');
     return respond({ok:true});
   }
 }
 if(section==='my-attendance'&&!id&&method==='GET'){
   requireStudent(user);
   return respond(await db.all("SELECT l.id,l.starts,c.title,c.title_en,COALESCE(m.status,'unmarked') status FROM lessons l JOIN courses c ON c.id=l.course_id LEFT JOIN attendance_marks m ON m.lesson_id=l.id AND m.member_id=c.user_id WHERE c.user_id=? AND l.starts<=? AND COALESCE(l.change_kind,'')<>'cancelled' AND l.starts>=date('now','-6 months') ORDER BY l.starts DESC",user.id,new Date(Date.now()+3*3600000).toISOString().slice(0,19)+'+03:00'));
 }
 if(section==='student-card'&&!id&&method==='GET'){
   requireStudent(user);
   const record=await db.one('SELECT * FROM student_credentials WHERE user_id=?',user.id);
   if(!record)fail(404,'not_found');
   const png=await qrPng('CAMPUS:DEMO:'+record.pass_code);
   return respond({birth:record.birth_date,book:record.gradebook_no,qr:'data:image/png;base64,'+btoa(String.fromCharCode(...png))});
 }
 if(section==='profile') {
        if (id && id !== user.id)
            fail(404, 'not_found');
        if (method === 'GET')
            return respond(user);
        if (method === 'PATCH') {
            requireStudent(user);
            const input = z.object({ email: z.string().email().max(160), phone: z.string().max(30), avatar: z.enum(['ink', 'gold', 'slate']) }).strict().parse(await json(req));
            await db.run('UPDATE users SET email=?,phone=?,avatar=? WHERE id=?', input.email, input.phone, input.avatar, user.id);
            return respond(await db.one('SELECT ' + userColumns + ' FROM users WHERE id=?', user.id));
        }
    }
    if (section === 'grades' && method === 'GET') {
        requireStudent(user);
        if (id && id !== user.id)
            fail(404, 'not_found');
        return respond({ courses: await d.courses(user), history: await db.all('SELECT h.*,c.title,c.title_en FROM grade_history h JOIN courses c ON c.id=h.course_id WHERE c.user_id=? ORDER BY h.created_at DESC', user.id) });
    }
    if (section === 'requests') {
        if (user.role === 'teacher')
            fail(403, 'forbidden');
        if (!id && method === 'GET') {
            const status = url.searchParams.get('status');
            if (status && !statuses.includes(status))
                fail(422, 'invalid_input');
            return respond(await d.requests(user, status || undefined));
        }
        if (!id && method === 'POST')
            return respond(await d.createRequest(user, d.createRequestSchema.parse(await json(req))), 201);
        if (id && !action && method === 'GET')
            return respond(await d.requestDetail(user, id));
        if (id && !action && method === 'PATCH')
            return respond(await d.updateRequest(user, id, d.updateRequestSchema.parse(await json(req))));
        if (id && action === 'comments' && method === 'POST') {
            const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).strict().parse(await json(req));
            await limit(db, 'comment:' + user.id, 60, 3600000);
            return respond(await d.addComment(user, id, body));
        }
        if (id && action === 'document' && method === 'GET') {
            const data = await documentData(db, await d.requestDetail(user, id), url.origin);
            if (url.searchParams.get('format') === 'pdf')
                return new Response(await makePdf(data), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="campus-demo.pdf"' } });
            return respond(data);
        }
    }
    if (section === 'notifications') {
        if (method === 'PATCH') {
            const { all: markAll } = z.object({ all: z.boolean().optional() }).strict().parse(await json(req));
            if (id) {
                const result = await db.run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE id=? AND user_id=?', new Date().toISOString(), id, user.id);
                if (!result.changes)
                    fail(404, 'not_found');
            }
            else if (markAll)
                await db.run('UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=?', new Date().toISOString(), user.id);
            else
                fail(422, 'invalid_input');
            return respond({ ok: true });
        }
    }
    if (section === 'tasks') {
        requireStudent(user);
        if (method === 'POST' && !id) {
            const input = z.object({ title: z.string().trim().min(1).max(200), subject: z.string().max(120), due: z.string().max(16).refine(v => !v || !Number.isNaN(Date.parse(v))) }).strict().parse(await json(req));
            const taskId = crypto.randomUUID();
            await db.run('INSERT INTO tasks VALUES(?,?,?,?,?,?)', taskId, user.id, input.title, input.subject, input.due, 0);
            return respond({ id: taskId }, 201);
        }
        if (id) {
            await d.owned('tasks', id, user.id);
            if (method === 'PATCH') {
                const input = z.object({ done: z.boolean() }).strict().parse(await json(req));
                await db.run('UPDATE tasks SET done=? WHERE id=? AND user_id=?', input.done ? 1 : 0, id, user.id);
                return respond({ ok: true });
            }
            if (method === 'DELETE') {
                await db.run('DELETE FROM tasks WHERE id=? AND user_id=?', id, user.id);
                return respond({ ok: true });
            }
        }
    }
    if (section === 'reflections') {
        requireStudent(user);
        if (method === 'POST' && !id) {
            const input = z.object({ body: z.string().trim().min(1).max(5000), mood: z.enum(['', 'easy', 'mixed', 'hard']) }).strict().parse(await json(req));
            const rid = crypto.randomUUID();
            await db.run('INSERT INTO reflections VALUES(?,?,?,?,?)', rid, user.id, input.body, input.mood, new Date().toISOString());
            return respond({ id: rid }, 201);
        }
        if (id && method === 'DELETE') {
            await d.owned('reflections', id, user.id);
            await db.run('DELETE FROM reflections WHERE id=? AND user_id=?', id, user.id);
            return respond({ ok: true });
        }
    }
    if (section === 'events' && id && !action && method === 'PATCH') {
        const { registered } = z.object({ registered: z.boolean() }).strict().parse(await json(req));
        return respond(await d.setRegistration(user, id, registered));
    }
    if (section === 'lessons' && id && !action && method === 'PATCH')
        return respond(await d.updateLesson(user, id, await json(req)));
    if (section === 'chat' && id) {
        if (method === 'GET')
            return respond(await d.getChat(user, id));
        if (method === 'POST') {
            const bytes = await readBytes(req, 2200000);
            let form;
            try {
                form = await new Response(bytes, { headers: { 'content-type': req.headers.get('content-type') || '' } }).formData();
            }
            catch {
                return fail(422, 'invalid_input');
            }
            return respond(await d.sendMessage(user, id, form));
        }
    }
    if (section === 'attachments' && id && method === 'GET') {
        const file = await d.attachment(user, id);
        return new Response(new Uint8Array(file.content), { headers: { 'Content-Type': file.mime, 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(file.name), 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    }
    if (section === 'staff' && method === 'GET') {
        requireStaff(user);
        return respond(await d.requests(user));
    }
    return fail(404, 'not_found');
}
