
# Use an official Node.js runtime as a parent image
FROM node:18
# Create a user for running the application
# Set working directory
WORKDIR /app
# Copy package.json and install Node.js dependencies
COPY --chown=node . /app
RUN npm install
RUN npm run build
# Copy application code
# Expose port
EXPOSE 7860
# Run the serve
# Command to run the application
CMD ["npm", "start"]
