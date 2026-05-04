import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

// Utility to create Google Meet links via Google Calendar API
// Requires GCP Service Account with Domain-Wide Delegation, or OAuth2 tokens

export async function createGoogleMeet(summary: string, description: string, startTime: string, endTime: string): Promise<string> {
  try {
    // For MVP/Development, if credentials are not set, return a mock link
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.warn('[Google Meet] Credentials not found in ENV. Generating a mock Meet link.');
      return `https://meet.google.com/mock-${Math.random().toString(36).substring(2, 7)}-${Math.random().toString(36).substring(2, 7)}`;
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/calendar'],
      // subject: 'admin@yourdomain.com' // Required if using GSuite domain-wide delegation
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary,
      description,
      start: {
        dateTime: startTime, // ISO format: '2026-05-10T10:00:00+05:30'
        timeZone: 'Asia/Colombo',
      },
      end: {
        dateTime: endTime,
        timeZone: 'Asia/Colombo',
      },
      conferenceData: {
        createRequest: {
          requestId: uuidv4(),
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: 1,
    });

    return response.data.hangoutLink || `https://meet.google.com/mock-fallback`;
  } catch (error) {
    console.error('Failed to create Google Meet:', error);
    // Return a mock fallback so the booking doesn't completely fail
    return `https://meet.google.com/fallback-${Math.random().toString(36).substring(2, 7)}`;
  }
}
