import { awsService } from './src/services/awsService';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Testing admin login logic directly against DynamoDB...');
  const email = 'dhanushhari150504@gmail.com';
  const password = 'Dhanush@1505';

  const user = await awsService.getUserByEmail(email);
  console.log('Found user:', user ? 'Yes' : 'No');
  
  if (user) {
    console.log('User role:', user.role);
    const isMatch = await bcrypt.compare(password, user.passwordHash || '');
    console.log('Password isMatch:', isMatch);
  } else {
    // maybe try to list all users to see if it's there?
    console.log('Did not find user inside DynamoDB!');
  }
}

main().catch(console.error);
