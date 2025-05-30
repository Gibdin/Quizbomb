# QuizBomb – Installation & Setup Guide

- **Node.js** v16.x or newer  
- **npm** v8.x or newer (bundled with Node.js)  
- **Docker** (optional, for containerized deployment)

- Install server & Client dependencies with 
    - **npm ci**
    through the CLI

- To run the app as a developer 
    **npm run dev**

- To run the app in production
    **npm start**

    the server will start on index.js on port 3000

- To run tests run
    **npm test**
    It will use Jest and Jsdom for the server unit tests

# ESLint

**npm run lint** or **npm run lint:fix** to either check or auto-fix concerns

# Prettier
**npm run check-format** to check for formatting 
**npm run format** for auto-formatting

## Building the Docker

- Build the image with 
    **docker build -t quizbomb .**

    and then run the container with
    **docker run -p 3000:3000 quizbomb**
    open the localhost:3000 on your browser after 