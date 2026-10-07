-- Align legacy product categories with the public website category filter
UPDATE "Product" SET "category" = 'Car Tyres' WHERE "category" = 'Car Tyre';
UPDATE "Product" SET "category" = 'Bike Tyres' WHERE "category" = 'Bike Tyre';
UPDATE "Product" SET "category" = 'Commercial Tyres' WHERE "category" IN ('Truck Tyre', 'Bus Tyre', 'Tractor Tyre');
UPDATE "Product" SET "category" = 'Other' WHERE "category" IN ('Tube', 'Alloy Wheel', 'Battery', 'Puncture Accessories', 'Other Accessories');
