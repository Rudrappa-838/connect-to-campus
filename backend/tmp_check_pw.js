const bcrypt = require('bcrypt');
async function test() {
  const hash = "$2b$10$l8Fyp49zhESqun4q6RVdP.I6f5VV1KDmwC5JOBR4pLuO35use1V2.";
  const match = await bcrypt.compare("123456", hash);
  console.log("MATCH:", match);
  process.exit(0);
}
test().catch(console.error);
