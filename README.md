# 教會活動籌辦系統 | Church Event Organizer

Version 1.0.0

A comprehensive event management system designed for church activities, featuring registration tracking, attendance management, follow-up management, and detailed analytics.

## Features

### Core Modules

1. **活動管理 (Event Management)**
   - Create and manage events with dates and times
   - Track event status and participant counts
   - Export event data to CSV and PDF

2. **報名管理 (Registration Management)**
   - Manage participant registrations
   - Track helper assignments
   - Link contacts to specific events
   - Quick registration interface

3. **出席記錄 (Attendance Tracking)**
   - Track attendance for each event session
   - Quick check-in interface
   - Real-time attendance statistics
   - Export attendance reports

4. **跟進管理 (Follow-up Management)**
   - Track follow-up actions for participants
   - Categorize by status (pending, in-progress, completed)
   - Record notes and progress
   - Filter by event and status

5. **聯絡人管理 (Contact Management)**
   - Comprehensive contact database
   - CSV import/export functionality
   - Link contacts to multiple events
   - Track faith status and source groups
   - Downloadable CSV template for bulk imports

6. **統計摘要 (Summary Dashboard)**
   - Real-time statistics across all modules
   - Visual overview of key metrics
   - Event participation trends
   - Follow-up progress tracking

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Data Export**: CSV and PDF generation

## Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Modern web browser

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run database migrations (already applied in Supabase)

## Development

Start the development server:
```bash
npm run dev
```

## Production Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Database Schema

The system uses the following main tables:
- `events` - Event information and scheduling
- `contacts` - Contact database with roles and metadata
- `registrations` - Event registration records
- `attendances` - Attendance tracking for events
- `follow_ups` - Follow-up action records
- `contact_events` - Junction table linking contacts to events

All tables have Row Level Security (RLS) enabled for data protection.

## CSV Import Feature

The contact management module supports bulk import via CSV:
1. Click "匯入CSV" button
2. Download the CSV template
3. Fill in contact data following the template format
4. Upload and import the completed CSV file

Template includes:
- Contact information (name, role, faith status, source group)
- Believer status
- Notes
- Event associations (semicolon-separated)

## Security

- All database operations use Supabase RLS policies
- Public access enabled for event organizer use cases
- Environment variables for sensitive configuration
- No hardcoded credentials

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## License

Private - Church Event Organizer v1.0

## Support

For issues or questions, please contact the system administrator.

---

© 2024 Church Event Organizer System
