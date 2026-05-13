import { connectDB } from './db';
import { User } from './models/User';

export async function isSetupComplete(): Promise<boolean> {
  await connectDB();
  const count = await User.countDocuments({});
  return count > 0;
}
