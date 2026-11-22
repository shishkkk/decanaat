import {z} from 'zod';
import {fail,requireStudent,requireStaff,token} from './support';
import {rateLimit as limit} from './auth';
import {Database} from './db';
const services=['study','military','official','academic','aid','transfer','retake','extension','question'];
const randomUUID=()=>crypto.randomUUID();
export function domain(db:Database) {
 const all=db.all,one=db.one;
 let writes:any[]|null=null;
 const run=(sql:string,...args:any[])=>writes?(writes.push(db.statement(sql,...args)),{changes:1}):db.run(sql,...args);
 const rateLimit=(key:string,max:number,ms:number)=>limit(db,key,max,ms);
 async function transaction(callback:()=>any){
   const rev=await db.revision();writes=[];
   try{const result=await callback();await db.commit(rev,writes);writes=null;return typeof result==='function'?await result():result;}finally{writes=null;}
 }
async function calendarData(user) {
    if (user.role !== 'student')
        return { events: [], exams: [] };
    return {
        events: (await all('SELECT e.*,EXISTS(SELECT 1 FROM event_registrations r WHERE r.event_id=e.id AND r.user_id=?) AS registered FROM campus_events e ORDER BY e.starts', user.id)),
        exams: (await all('SELECT c.id AS course_id,c.title,c.title_en,e.starts,e.room FROM exams e JOIN courses c ON c.id=e.course_id WHERE c.user_id=? ORDER BY e.starts', user.id))
    };
}
async function setRegistration(user, eventId, registered) {
    requireStudent(user);
    return (await transaction(async () => {
        const event = (await one('SELECT starts FROM campus_events WHERE id=?', eventId));
        if (!event)
            return fail(404, 'not_found');
        if (Date.parse(event.starts) <= Date.now())
            return fail(409, 'event_closed');
        if (registered)
            (await run('INSERT OR IGNORE INTO event_registrations VALUES(?,?)', eventId, user.id));
        else
            (await run('DELETE FROM event_registrations WHERE event_id=? AND user_id=?', eventId, user.id));
        return { ok: true };
    }));
}
async function recordTeacherActivity(user) {
    if (user.role !== 'teacher')
        return;
    const now = Date.now();
    (await run('UPDATE users SET last_seen_at=? WHERE id=? AND (last_seen_at IS NULL OR last_seen_at<?)', new Date(now).toISOString(), user.id, new Date(now - 30000).toISOString()));
}

const requestSelect = 'SELECT r.id,r.number,r.user_id,u.name as student_name,u.group_name,r.type,r.delivery,r.body,r.status,r.created_at,r.updated_at,r.version FROM requests r JOIN users u ON u.id=r.user_id';
async function requests(user, status) {
    const where = user.role === 'staff' ? '1=1' : 'r.user_id=?';
    const params = user.role === 'staff' ? [] : [user.id];
    if (status)
        params.push(status);
    return (await all(requestSelect + ' WHERE ' + where + (status ? ' AND r.status=?' : '') + ' ORDER BY r.created_at DESC', ...params));
}
async function requestDetail(user, id) {
    const item = (await one(requestSelect + ' WHERE r.id=?' + (user.role === 'staff' ? '' : ' AND r.user_id=?'), ...user.role === 'staff' ? [id] : [id, user.id]));
    if (!item)
        return fail(404, 'not_found');
    return { ...item, history: (await all('SELECT h.id,h.status,h.comment,u.name as actor,h.created_at FROM request_history h JOIN users u ON u.id=h.actor_id WHERE h.request_id=? ORDER BY h.rowid', id)), comments: (await all('SELECT c.id,c.body,u.name as author,u.role,c.created_at FROM request_comments c JOIN users u ON u.id=c.user_id WHERE c.request_id=? ORDER BY c.rowid', id)) };
}
async function courses(user) { return (await all('SELECT id,title,title_en,teacher_id,teacher,teacher_en,semester,assessment,grade,passed,debt,credits FROM courses WHERE user_id=? ORDER BY semester DESC,title', user.id)); }
async function lessons(user) { return (await all('SELECT l.*,u.group_name,c.title,c.title_en,c.teacher_id,c.teacher,c.teacher_en FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.user_id WHERE ' + (user.role === 'teacher' ? 'c.teacher_id' : 'c.user_id') + '=? ORDER BY l.starts', user.id)); }
async function notify(uid, title, titleEn, body, bodyEn, kind, link) { (await run('INSERT INTO notifications VALUES(?,?,?,?,?,?,?,?,?,?)', randomUUID(), uid, title, titleEn, body, bodyEn, kind, link, null, new Date().toISOString())); }
async function bootstrap(user, csrf) {
    (await recordTeacherActivity(user));
    const teaching = user.role === 'teacher' ? (await all('SELECT c.id,c.title,c.title_en,c.semester,u.name AS student,u.name_en AS student_en,u.group_name,(SELECT MAX(m.created_at) FROM conversations v JOIN messages m ON m.conversation_id=v.id WHERE v.course_id=c.id AND v.user_id=u.id) AS last_message FROM courses c JOIN users u ON u.id=c.user_id WHERE c.teacher_id=? ORDER BY last_message DESC,c.semester DESC,c.title', user.id)) : [];
    return { user, csrf, teaching, ...(await calendarData(user)), recentGrades: user.role === 'student' ? (await all('SELECT h.id,h.course_id,c.title,c.title_en,h.grade,h.created_at FROM grade_history h JOIN courses c ON c.id=h.course_id WHERE c.user_id=? ORDER BY h.created_at DESC,h.rowid DESC LIMIT 3', user.id)) : [], courses: user.role === 'student' ? (await courses(user)) : [], lessons: user.role === 'staff' ? [] : (await lessons(user)), requests: user.role === 'teacher' ? [] : (await requests(user)), notices: (await all('SELECT id,title,title_en,body,body_en,kind,link,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100', user.id)), tasks: (await all('SELECT id,title,subject,due,done FROM tasks WHERE user_id=? ORDER BY done,due,title', user.id)), reflections: (await all('SELECT id,body,mood,created_at FROM reflections WHERE user_id=? ORDER BY created_at DESC', user.id)), now: new Date().toISOString() };
}
async function owned(table, id, uid) {
    const record = (await one('SELECT id FROM ' + table + ' WHERE id=? AND user_id=?', id, uid));
    if (!record)
        fail(404, 'not_found');
    return record;
}

const createRequestSchema = z.object({ type: z.enum(services), delivery: z.enum(['digital', 'paper']), body: z.string().trim().min(10).max(4000) }).strict();
const updateRequestSchema = z.object({ status: z.enum(['accepted', 'processing', 'clarification', 'ready', 'rejected']), comment: z.string().trim().max(2000), version: z.number().int().positive() }).strict();
const transitions = { created: ['accepted', 'rejected'], accepted: ['processing', 'clarification', 'rejected'], processing: ['clarification', 'ready', 'rejected'], clarification: ['processing', 'rejected'], ready: [], rejected: [] };
async function createRequest(user, input) {
    requireStudent(user);
    (await rateLimit('request:' + user.id, 30, 3600000));
    return (await transaction(async () => {
        const id = randomUUID(), now = new Date().toISOString();
        const number = (await one('SELECT COALESCE(MAX(number),2400)+1 as n FROM requests')).n;
        (await run('INSERT INTO requests VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, number, user.id, input.type, input.delivery, input.body, 'created', 1, now, now, token(24)));
        (await run('INSERT INTO request_history VALUES(?,?,?,?,?,?)', randomUUID(), id, 'created', '', user.id, now));
        (await notify(user.id, 'Заявка создана', 'Request created', 'Обращение № ' + number + ' зарегистрировано.', 'Request #' + number + ' has been registered.', 'request', '/requests/' + id));
        return async () => (await requestDetail(user, id));
    }));
}
async function updateRequest(user, id, input) {
    requireStaff(user);
    return (await transaction(async () => {
        const item = (await requestDetail(user, id));
        if (item.version !== input.version)
            fail(409, 'conflict');
        if (!transitions[item.status].includes(input.status))
            fail(422, 'invalid_transition');
        if (['clarification', 'rejected'].includes(input.status) && input.comment.length < 5)
            fail(422, 'comment_required');
        const now = new Date().toISOString();
        (await run('UPDATE requests SET status=?,version=version+1,updated_at=? WHERE id=?', input.status, now, id));
        (await run('INSERT INTO request_history VALUES(?,?,?,?,?,?)', randomUUID(), id, input.status, input.comment, user.id, now));
        (await notify(item.user_id, 'Статус заявки обновлён', 'Request status updated', 'Откройте обращение № ' + item.number + '.', 'Open request #' + item.number + '.', 'request', '/requests/' + id));
        return async () => (await requestDetail(user, id));
    }));
}
async function addComment(user, id, body) {
    return (await transaction(async () => {
        const item = (await requestDetail(user, id));
        if (['ready', 'rejected'].includes(item.status))
            fail(422, 'request_closed');
        const now = new Date().toISOString();
        (await run('INSERT INTO request_comments VALUES(?,?,?,?,?)', randomUUID(), id, user.id, body, now));
        if (user.role === 'student' && item.status === 'clarification') {
            (await run('UPDATE requests SET status=?,version=version+1,updated_at=? WHERE id=?', 'processing', now, id));
            (await run('INSERT INTO request_history VALUES(?,?,?,?,?,?)', randomUUID(), id, 'processing', 'Уточнение получено', user.id, now));
        }
        if (user.role === 'staff')
            (await notify(item.user_id, 'Ответ деканата', 'Dean’s office reply', 'Новый комментарий к обращению № ' + item.number + '.', 'New comment on request #' + item.number + '.', 'request', '/requests/' + id));
        return async () => (await requestDetail(user, id));
    }));
}

const localTime = z.iso.datetime({ local: true, precision: -1 }).refine(v => v.length === 16);
const common = { reason: z.string().trim().min(3).max(300), expected: z.string().max(1500) };
const change = z.discriminatedUnion('action', [
    z.object({ ...common, action: z.literal('cancel') }).strict(),
    z.object({ ...common, action: z.literal('edit'), start: localTime, end: localTime,
        building: z.string().trim().min(1).max(50), room: z.string().trim().min(1).max(40) }).strict()
]);
async function updateLesson(user, id, input) {
    if (user.role !== 'teacher')
        return fail(403, 'forbidden');
    const data = change.parse(input);
    return (await transaction(async () => {
        const lesson = (await one('SELECT l.*,c.user_id,c.title,c.title_en,u.group_name FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.user_id WHERE l.id=? AND c.teacher_id=?', id, user.id));
        if (!lesson)
            return fail(404, 'not_found');
        const snapshot = JSON.stringify([lesson.starts, lesson.ends, lesson.building, lesson.room, lesson.change_kind, lesson.reason]);
        if (snapshot !== data.expected)
            return fail(409, 'lesson_changed');
        if (Date.parse(lesson.ends) <= Date.now())
            return fail(422, 'lesson_ended');
        let kind = 'cancelled', start = lesson.starts, end = lesson.ends, room = lesson.room, building = lesson.building;
        if (data.action === 'cancel') {
            if (lesson.change_kind === 'cancelled')
                return fail(409, 'lesson_changed');
        }
        else {
            start = data.start + ':00+03:00';
            end = data.end + ':00+03:00';
            room = data.room;
            building = data.building;
            if (start.slice(0, 10) !== end.slice(0, 10) || end <= start || Date.parse(end) <= Date.now())
                return fail(422, 'lesson_time');
            const changesTime = start !== lesson.starts || end !== lesson.ends;
            const changesPlace = room !== lesson.room || building !== lesson.building;
            if (!changesTime && !changesPlace && lesson.change_kind !== 'cancelled')
                return fail(422, 'lesson_unchanged');
            const conflict = (await one('SELECT l.id FROM lessons l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=c.user_id WHERE l.id<>? AND COALESCE(l.change_kind,?)<>? AND l.starts<? AND l.ends>? AND (c.teacher_id=? OR u.group_name=? OR (l.building=? AND l.room=?)) LIMIT 1', id, '', 'cancelled', end, start, user.id, lesson.group_name, building, room));
            if (conflict)
                return fail(409, 'lesson_overlap');
            kind = changesTime ? 'moved' : changesPlace ? 'room' : 'restored';
        }
        (await run('UPDATE lessons SET starts=?,ends=?,building=?,room=?,change_kind=?,reason=?,reason_en=?,old_room=? WHERE id=?', start, end, building, room, kind, data.reason, data.reason, lesson.room, id));
        (await notify(lesson.user_id, kind === 'cancelled' ? 'Пара отменена' : 'Расписание изменено', kind === 'cancelled' ? 'Class cancelled' : 'Schedule updated', lesson.title + ' · ' + data.reason, lesson.title_en + ' · ' + data.reason, 'schedule', '/schedule'));
        return { ok: true };
    }));
}

function courseAccess(user) {
    if (user.role === 'teacher')
        return 'c.teacher_id=?';
    if (user.role === 'student')
        return 'c.user_id=?';
    return fail(403, 'forbidden');
}
async function getChat(user, courseId) {
    const access = courseAccess(user);
    const course = (await one('SELECT c.id,c.user_id,c.title,c.title_en,c.teacher,c.teacher_en,u.name AS student,u.name_en AS student_en,(SELECT t.last_seen_at FROM users t WHERE t.id=c.teacher_id) AS teacher_seen_at,EXISTS(SELECT 1 FROM users t WHERE t.id=c.teacher_id AND t.role=?) AS connected FROM courses c JOIN users u ON u.id=c.user_id WHERE c.id=? AND ' + access, 'teacher', courseId, user.id));
    if (!course)
        return fail(404, 'not_found');
    (await run('INSERT OR IGNORE INTO conversations VALUES(?,?,?)', randomUUID(), course.user_id, courseId));
    const c = (await one('SELECT id FROM conversations WHERE course_id=? AND user_id=?', courseId, course.user_id));
    const messages = (await all('SELECT m.id,m.body,m.sender,m.created_at,a.id as attachment_id,a.name as attachment_name,a.size as attachment_size FROM messages m LEFT JOIN attachments a ON a.message_id=m.id WHERE m.conversation_id=? ORDER BY m.rowid', c.id)).map(m => ({ id: m.id, body: m.body, sender: m.sender, created_at: m.created_at, attachment: m.attachment_id ? { id: m.attachment_id, name: m.attachment_name, size: m.attachment_size } : null }));
    return { ...course, id: c.id, course_id: course.id, messages };
}
async function sendMessage(user, courseId, form) {
    courseAccess(user);
    (await rateLimit('chat:' + user.id, 60, 3600000));
    const chat = (await getChat(user, courseId));
    const body = String(form.get('body') || '').trim();
    const file = form.get('file');
    if (body.length > 3000)
        fail(422, 'invalid_input');
    let attachment = null;
    if (file instanceof File && file.size) {
        if (file.size > 2 * 1024 * 1024)
            fail(413, 'file_too_large');
        const data = new Uint8Array(await file.arrayBuffer());
        const name = file.name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9._ ()-]/g, '_').slice(0, 120);
        let mime = '';
        const ext = name.toLowerCase().split('.').pop();
        if (ext === 'pdf' && new TextDecoder().decode(data.subarray(0, 5)) === '%PDF-')
            mime = 'application/pdf';
        if (ext === 'png' && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => data[i] === v))
            mime = 'image/png';
        if (['jpg', 'jpeg'].includes(ext || '') && data[0] === 255 && data[1] === 216 && data[2] === 255)
            mime = 'image/jpeg';
        if (ext === 'txt' && !data.includes(0))
            mime = 'text/plain';
        if (!mime)
            fail(422, 'file_type');
        attachment = { name, mime, data };
    }
    if (!body && !attachment)
        fail(422, 'empty_message');
    (await transaction(async () => {
        const id = randomUUID();
        (await run('INSERT INTO messages VALUES(?,?,?,?,?)', id, chat.id, user.role, body, new Date().toISOString()));
        if (attachment) {
            const aid = randomUUID();
            (await run("INSERT INTO attachments VALUES(?,?,?,?,?,x'')", aid, id, attachment.name, attachment.mime, attachment.data.length));
            for (let start = 0; start < attachment.data.length; start += 131072) {
                (await run('INSERT INTO attachment_chunks VALUES(?,?,?)', aid, start, attachment.data.slice(start, start + 131072).buffer));
            }
        }
    }));
    return (await getChat(user, courseId));
}
async function attachment(user, id) {
    const access = courseAccess(user);
    const row = (await one('SELECT a.name,a.mime,a.content FROM attachments a JOIN messages m ON m.id=a.message_id JOIN conversations v ON v.id=m.conversation_id JOIN courses c ON c.id=v.course_id AND c.user_id=v.user_id WHERE a.id=? AND ' + access, id, user.id));
    if (!row)
        return fail(404, 'not_found');
    const chunks = await db.all('SELECT content FROM attachment_chunks WHERE attachment_id=? ORDER BY seq', id);
    row.content = Uint8Array.from(chunks.flatMap(chunk => Array.from(chunk.content)));
    return row;
}

 return {requests,requestDetail,courses,bootstrap,owned,createRequestSchema,updateRequestSchema,createRequest,updateRequest,addComment,updateLesson,getChat,sendMessage,attachment,setRegistration};
}