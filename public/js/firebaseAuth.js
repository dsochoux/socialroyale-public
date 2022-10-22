function signInWithGoogle(){
    var googleAuthProvider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(googleAuthProvider)
        .then( function(data) {
            console.log(data)
            var photoURL = data.additionalUserInfo.profile.picture

            var idToken = data.credential.idToken
            var displayName = data.user.displayName
            var userEmail = data.user.email
            var photoURL = data.user.photoURL

            var login = $.ajax({
                url: "/glogin",
                type: "POST",
                data: {
                  "email": userEmail,
                  "displayName": displayName,
                  "photoURL": photoURL
                },
                dataType: "json"
            });

            login.done(function (resp) {
                if (resp['status'] == "ok") {
                    //alert("OK!");
                    //document.cookie = "currentUser=" + userEmail;
                    //document.cookie = "currentUser=" + userEmail + "; path=/"
                    //Cookies.set("currentUser", userEmail);
                    //document.cookie = "currentUserDisplayName=" + displayName;
                    //document.cookie = "currentUserDisplayName=" + displayName + "; path=/"
                    //Cookies.set("currentUserDisplayName", displayName);
                    //Cookies.set('test', 'hello');
                    window.location.href = '/auth?'+'email='+userEmail+'&token='+resp['token'];
                } else {
                    alert("Not OK!");
                }
            });

            // document.getElementById('google-pic')
            //         .setAttribute('src', photoURL)

            // checkIfLoggedIn()
        });
}

function signOut() {
    firebase.auth().signOut()
}

// function checkIfLoggedIn(){
//     firebase.auth().onAuthStateChanged(function(user){
//         if ( user ) {
//             console.log( 'User signed in' )
//             console.log( user )
//             var photoURL = user.photoURL
//
//         } else {
//             console.log( 'User not signed in.' )
//             // do not logged in stuff
//
//         }
//     });
//
// }
