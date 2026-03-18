// This is a comment. This line is ignored.
// This is an example of a CodeSpeak specification file.
// Feel free to improve it, experiment wildly, and then run "codespeak build" 
// to see what awesome things happen!

# Tic-tac-toe game

The app implements a tic-tac-toe a game for 2 players.
Player one is the user normally a  human the second is HAL the computer.
Use minimax + alpha-beta pruning for HAL responses
Humans alwway start first.


## Look and feel

- Use material UI for Android device
- Use windows look and feel for windows devices
- Use Mac look and feel for Mac OS devices

## Technology

- Use pure HTML + JS
- Use any library that fits the need for css styling
- Keep css in it's one files, don't mix css with HTML 
- Should be playable in any device
- Should be PWA app
- Use docker as container for app
- Provide that localhost works on `http://localhost:8080`
- No custom HTTPS or local domain is required; we will expose/share via Tailscale Tunnel (or Serve/Funnel). The container serves HTTP only.

## Tests

- write a test to verify if docker is running.
- write a test to verify the HTTP endpoint responds (default `http://localhost:8080`, or `BASE_URL` if provided — e.g., a Tailscale URL).
- write a UI test on tic-tac-toe that responds on the chosen base URL (`BASE_URL`), and also on localhost when different.


## Run

- Run all tests; if any fail, fix and re-run until all tests are ok.

