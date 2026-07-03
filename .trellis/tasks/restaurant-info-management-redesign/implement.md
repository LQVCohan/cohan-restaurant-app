# Implementation plan

1. Fetch latest RestaurantInfo component, SCSS and copy-tuning file.
2. Add the existing `rewriteRestaurantProfileDescription` operation to the Apollo component and replace the local template handler.
3. Feed existing rating/category/layout/draft data into `ManagementPageHeader`; remove the duplicate metric row.
4. Update copy and native controls in the component without changing GraphQL save/upload/preview contracts.
5. Refine only the existing SCSS: header density, identity uploader, tab/form spacing, preview and mobile stacking.
6. Delete the unused DOM mutation bridge after verifying no caller.
7. Run conflict, GraphQL, targeted rewrite-service test and build checks; review diff for scope/permission drift.
