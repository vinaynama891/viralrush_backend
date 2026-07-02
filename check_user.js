const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

async function clearMockYT() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  // Clear mock youtube data for notesforyou40@gmail.com
  const res = await User.updateOne(
    { email: 'notesforyou40@gmail.com' },
    {
      $set: {
        'youtube.channelId': '',
        'youtube.accessToken': '',
        'youtube.refreshToken': '',
        'youtube.channelData': null,
        'youtube.uploadsPlaylistId': '',
        'youtube.lastSync': null
      }
    }
  );
  console.log('Cleared mock YT data for notesforyou40@gmail.com:', res);
  await mongoose.disconnect();
}

clearMockYT().catch(console.error);
