const bcrypt = require('bcrypt.js');

const password = 'password123'; // your password

bcrypt.hash(password, 10).then(hash => {
    console.log(hash);
});