import  axios from 'axios';

async function testRaceCondition() {
    const url = 'http://localhost:9000/api/auth/register/local';
    const payload = {
        username: 'testuser123',
        password: 'password123'
    }

    const reqs = Array.from({length: 100}, () =>{
        return axios.post(url,payload).catch((err) => err.response);
    });

    const res = await Promise.all(reqs);
    const summary = res.reduce((acc,res)=>{
        const status = res.status || 'What?';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    },{});

    console.table(Object.entries(summary).map(([status, count]) => ({
        'HTTP Status': status,
        'Count': count,
        'Result': status === '201' ? 'SUCCESS' : status === '409' ? 'CONFLICT' : 'UNKNOWN'
      })));
}

testRaceCondition();