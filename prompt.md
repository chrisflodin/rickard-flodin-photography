I want us to plan building a website where I can upload my photos that I use for photography.

### Here are the criteria:

Homepage:
- It should have a landing home page which is a masonry with images.
- I want to be able to enter credentials on an /admin page, and when I do log in, I have admin rights. One of the admin rights is that I can upload new images and reorder them directly in the masonry UI, so I can drag an image and then I will see where it's going to land with indicators.


Details page
If I click on an image, it will go to that detail page of that image, and it will show the image in full width. Underneath that, we will have the following properties:
- Name of picture
- Description
- Price (optional)
- Small section to the right that says ORDER. -> We haven't yet defined what clicking on order does.
- All these fields should be editable inline by an admin.

About
It should have an about page that explains a little bit about the photographer. On that page, we are going to have an image of the photographer on the left and a description on the right. This image, the admin user should be able to upload and change. 

- These images should be of very high quality but, of course, be optimized for the web so that they hold high quality but load as fast as possible. This optimization will happen with Next.js, but I also want the upload to be optimized automatically. Not only when it gets served does it get optimized, but I can just upload an image that actually is too large, and it will handle it for me and resize it to a reasonable size.


### Technical requirements
- Built with Next.js and have a similar repository structure as /Users/christopher.flodin/Desktop/Desktop/code/sidegigs/stockholm-plastikkirurgi/stockholm-plastikkirurgi.
- Storage will be in Supabase unless you have an idea of better service for this.