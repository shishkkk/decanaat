process.env.DEMO_MODE='true';
const {db}=await import('../src/server/db');
const count=db().prepare('SELECT count(*) as count FROM users').get();
console.log('Seed complete (existing records preserved):',count);

export {};
