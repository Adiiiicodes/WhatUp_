# Admin Panel Changes

## AdminDashboardClient.tsx

- A new client component `AdminDashboardClient.tsx` has been created, likely from the previous `page.tsx` in the admin section.
- It includes functionality for fetching and displaying users, adding a new user, and making a user an admin.
- A logout button has been added, which redirects to the admin login page.
- The user list is now fetched from `/api/admin/users`.

## ConversationList.tsx

- The component now fetches conversations from `/api/admin/conversations`.
- It includes logic to determine the last message of a conversation to display in the list.

## ConversationModal.tsx

- This component remains unchanged and is used to display the messages of a selected conversation.
