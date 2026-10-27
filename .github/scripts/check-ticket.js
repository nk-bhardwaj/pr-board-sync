const fs = require('fs');
const { extractTicketId } = require('./lib.js');

const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));

if (!event.pull_request) {
  console.log('Not a pull request event, skipping check');
  process.exit(0);
}

const branch = event.pull_request.head.ref;
const title = event.pull_request.title;
const body = event.pull_request.body || '';
const ticketId = extractTicketId(branch, title, body);

if (!ticketId) {
  console.error('PR must reference a ticket like AB#123 in the branch, title, or body');
  process.exit(1);
}

console.log('Ticket ID found:', ticketId);
