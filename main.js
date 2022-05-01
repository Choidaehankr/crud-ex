/**
 * 데이터베이스 사용하기
 * 
 * 비밀번호 암호화와 입력값 유효성 확인
 *
 * 웹브라우저에서 아래 주소의 페이지를 열고 웹페이지에서 요청
 * (먼저 사용자 추가 후 로그인해야 함)
 *  	사용자 CRUD 기능
 *    http://localhost:3000/public/1_adduser_page.html
 *    http://localhost:3000/public/1_login_page.html
 *	  http://localhost:3000/public/1_listuser.html
 *	  http://localhost:3000/public/1_updateuser.html
 *	  http://localhost:3000/public/1_deleteuser.html

		사진 CRD 기능.
 	http://localhost:3000/public/2_addphoto.html
	http://localhost:3000/public/2_deletephoto.html
	http://localhost:3000/public/2_updatephoto.html

 * @date 2016-11-10
 * @author Mike
 */

// Express 기본 모듈 불러오기
var express = require('express')
  , http = require('http')
  , path = require('path');

// Express의 미들웨어 불러오기
var bodyParser = require('body-parser')
  , cookieParser = require('cookie-parser')
  , static = require('serve-static')
  , errorHandler = require('errorhandler');

// 에러 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

// Session 미들웨어 불러오기
var expressSession = require('express-session');
 
// mongoose 모듈 사용
var mongoose = require('mongoose');

// crypto 모듈 불러들이기
var crypto = require('crypto');  // 암호화 시키는 모듈


// 익스프레스 객체 생성
var app = express();

var multer = require('multer');

// 기본 속성 설정
app.set('port', process.env.PORT || 3000);

// body-parser를 이용해 application/x-www-form-urlencoded 파싱
app.use(express.urlencoded({ extended: false }))

// body-parser를 이용해 application/json 파싱
app.use(express.json())

// public 폴더를 static으로 오픈
// app.use('/public', static(path.join(__dirname, 'public')));
app.use('/', static(path.join(__dirname, '/')));
app.use(cookieParser());

// 세션 설정
app.use(expressSession({
	secret:'my key',
	resave:true,
	saveUninitialized:true
}));

//===== 데이터베이스 연결 =====//

// 데이터베이스 객체를 위한 변수 선언
var database;

// 데이터베이스 스키마 객체를 위한 변수 선언
var UserSchema;

var PhotoSchema;
// 데이터베이스 모델 객체를 위한 변수 선언
var UserModel;

var PhotoModel;


//데이터베이스에 연결
function connectDB() {
	// 데이터베이스 연결 정보
	var databaseUrl = 'mongodb://localhost:27017/local';
	 
	// 데이터베이스 연결
    console.log('데이터베이스 연결을 시도합니다.');
    mongoose.Promise = global.Promise;  // mongoose의 Promise 객체는 global의 Promise 객체 사용하도록 함
	mongoose.connect(databaseUrl);
	database = mongoose.connection;
	
	database.on('error', console.error.bind(console, 'mongoose connection error.'));	
	database.on('open', function () {
		console.log('데이터베이스에 연결되었습니다. : ' + databaseUrl);
		// user 스키마 및 모델 객체 생성
		createUserSchema();
		createPhotoSchema();  // add new
	});
	
    // 연결 끊어졌을 때 5초 후 재연결
	database.on('disconnected', function() {
        console.log('연결이 끊어졌습니다. 5초 후 재연결합니다.');
        setInterval(connectDB, 5000);
    });
}

function createPhotoSchema() {
	PhotoSchema = mongoose.Schema({
		author: {type: String, required: true, unique: false, 'default': ''},
		contents: {type:String, required:true, unique: false, 'default': ''}
	})
	PhotoModel = mongoose.model("Photo2", UserSchema);
	console.log('Photo2 정의함.');
}

// user 스키마 및 모델 객체 생성
function createUserSchema() {

	// 스키마 정의
	// password를 hashed_password로 변경, 각 칼럼에 default 속성 모두 추가, salt 속성 추가
	UserSchema = mongoose.Schema({
	    id: {type: String, required: true, unique: true, 'default':''},
	    hashed_password: {type: String, required: true, 'default':''},  // 암호화된 password <db에는 암호화된 password를 저장>
	    salt: {type:String, required:true},  // salt 값이 정해져있으면, 암호화된 password도 같음. 따라서 salt값은 알아서 바뀌어야함. 다만 처음 회원가입 할 때, 해당 사용자의 salt 값을 저장시켜서 사용자 암호를 해석한다.
	    name: {type: String, index: 'hashed', 'default':''},
	    age: {type: Number, 'default': -1},
	    created_at: {type: Date, index: {unique: false}, 'default': Date.now},
	    updated_at: {type: Date, index: {unique: false}, 'default': Date.now}
	});
	
	// password를 virtual 메소드로 정의 : MongoDB에 저장되지 않는 가상 속성임. 
    // 특정 속성을 지정하고 set, get 메소드를 정의함
	UserSchema.virtual('password').set(function(password) {  // 가상 password 속성. db에 저장안됨.
	    this._password = password;  // 암호화 안된거.
	    this.salt = this.makeSalt();  // 145L에 정의
	    this.hashed_password = this.encryptPassword(password);  // 136L에 정의
	    console.log('virtual password의 set 호출됨 : ' + this.hashed_password);
	  })
	  .get(function() {
           console.log('virtual password의 get 호출됨.');
           return this._password;
      });
	
	// 스키마에 모델 인스턴스에서 사용할 수 있는 메소드 추가
	// 비밀번호 암호화 메소드
	UserSchema.method('encryptPassword', function(plainText, inSalt) {  // plainText = password, inSalt = salt값
		if (inSalt) {
			return crypto.createHmac('sha1', inSalt).update(plainText).digest('hex');  // 설치한 모듈 crypto 사용. .createHmac('sha1', inSalt)에서 암호화가 이루어짐. update에서 password를 업데이트. 
		} else {
			return crypto.createHmac('sha1', this.salt).update(plainText).digest('hex');
		}
	});
	
	UserSchema.method('makeSalt', function() {
		return Math.round((new Date().valueOf() * Math.random())) + '';
	});
	
	// 인증 메소드 - 입력된 비밀번호와 비교 (true/false 리턴)
	UserSchema.method('authenticate', function(plainText, inSalt, hashed_password) {  //plainText: pwd, inSalt: 암호화할때 사용한 salt값, hased_password: db에 저장되어있는 암호화된 pwd
		if (inSalt) {
			console.log('authenticate 호출됨 : %s -> %s : %s', plainText, this.encryptPassword(plainText, inSalt), hashed_password);
			return this.encryptPassword(plainText, inSalt) === hashed_password;  // pwd를 암호화해서 저장된 값과 일치하는지 비교
		} else {
			console.log('authenticate 호출됨 : %s -> %s : %s', plainText, this.encryptPassword(plainText), this.hashed_password);
			return this.encryptPassword(plainText) === this.hashed_password;
		}
	});

	// 값이 유효한지 확인하는 함수 정의
	var validatePresenceOf = function(value) {
		return value && value.length;
	};
		
	// 저장 시의 트리거 함수 정의 (password 필드가 유효하지 않으면 에러 발생)
	UserSchema.pre('save', function(next) {  // 'SAVE'를 실행하기 전에 function을 실행하라. = "pre"  -> 사용자를 저장하는 것이 save인데, 사전에 유효성 검사를 진행함.
		if (!this.isNew) return next();  // 새로운 것이 아니면 다음으로 넘어가

		if (!validatePresenceOf(this.password)) {  // 값이 유효한지 확인 163.L
			next(new Error('유효하지 않은 password 필드입니다.'));
		} else {  // 유효하면 다음으로 넘어가서 save해라.
			next();
		}
	})
	
	// 필수 속성에 대한 유효성 확인 (길이값 체크)
	UserSchema.path('id').validate(function (id) {
		return id.length;
	}, 'id 칼럼의 값이 없습니다.');
	
	UserSchema.path('name').validate(function (name) {
		return name.length;
	}, 'name 칼럼의 값이 없습니다.');
	
	UserSchema.path('hashed_password').validate(function (hashed_password) {
		return hashed_password.length;
	}, 'hashed_password 칼럼의 값이 없습니다.');
	
	   
	// 스키마에 static으로 findById 메소드 추가
	UserSchema.static('findById', function(id, callback) {
		return this.find({id:id}, callback);
	});
	
    // 스키마에 static으로 findAll 메소드 추가
	UserSchema.static('findAll', function(callback) {
		return this.find({}, callback);
	});
	
	console.log('UserSchema 정의함.');
	
	// User 모델 정의
	UserModel = mongoose.model("Project", UserSchema);
	console.log('Project 정의함.');
	
}



//===== 라우팅 함수 등록 =====//

// 라우터 객체 참조
var router = express.Router();

// 로그인 라우팅 함수 - 데이터베이스의 정보와 비교
router.route('/process/login').post(function(req, res) {
	console.log('/process/login 호출됨.');

	// 요청 파라미터 확인
    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
	
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword);
	
    // 데이터베이스 객체가 초기화된 경우, authUser 함수 호출하여 사용자 인증
	if (database) {
		authUser(database, paramId, paramPassword, function(err, docs) {
			// 에러 발생 시, 클라이언트로 에러 전송
			if (err) {
                console.error('사용자 로그인 중 에러 발생 : ' + err.stack);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 로그인 중 에러 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
				res.end();
                
                return;
            }
			
            // 조회된 레코드가 있으면 성공 응답 전송
			if (docs) {
				console.dir(docs);

                // 조회 결과에서 사용자 이름 확인
				var username = docs[0].name;
				
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h1>로그인 성공</h1>');
				res.write('<h2>반갑습니다!</h2>')
				res.write('<div><p>사용자 아이디 : ' + paramId + '</p></div>');
				res.write('<div><p>사용자 이름 : ' + username + '님 </p></div>');
				//res.write("<br><br><a href='/public/login.html'>다시 로그인하기</a>");
				// add New
				res.write("<br><br><a href='/public/shareMemories.html'>추억 공유하기</a>");
				res.end();
			
			} else {  // 조회된 레코드가 없는 경우 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h1>로그인  실패</h1>');
				res.write('<div><p>아이디와 패스워드를 다시 확인하십시오.</p></div>');
				res.write("<br><br><a href='/public/login.html'>다시 로그인하기</a>");
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.write('<div><p>데이터베이스에 연결하지 못했습니다.</p></div>');
		res.end();
	}
	
});



// 사용자 추가 라우팅 함수 - 클라이언트에서 보내오는 데이터를 이용해 데이터베이스에 추가
router.route('/process/adduser').post(function(req, res) {
	console.log('/process/adduser 호출됨.');

    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;
	var paramAge = req.body.age || req.query.age; //add new
	
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword + ', ' + paramName + ', ' + paramAge);
    
    // 데이터베이스 객체가 초기화된 경우, addUser 함수 호출하여 사용자 추가
	if (database) {
		addUser(database, paramId, paramPassword, paramName, paramAge, function(err, addedUser) {
            // 동일한 id로 추가하려는 경우 에러 발생 - 클라이언트로 에러 전송
			if (err) {
                console.error('사용자 추가 중 에러 발생 : ' + err.stack);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 추가 중 에러 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
				res.end();
                
                return;
            }
			
            // 결과 객체 있으면 성공 응답 전송
			if (addedUser) {
				console.dir(addedUser);
 
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>Our Memories에 가입하신 것을 환영합니다!</h2>');
				res.write('<h3>우리 같이 멋진 추억을 공유해봐요!</h3>');
				res.end();
			} else {  // 결과 객체가 없으면 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 추가  실패</h2>');
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
	
});



//사용자 리스트 함수
router.route('/process/listuser').post(function(req, res) {
	console.log('/process/listuser 호출됨.');

    // 데이터베이스 객체가 초기화된 경우, 모델 객체의 findAll 메소드 호출
	if (database) {
		// 1. 모든 사용자 검색
		UserModel.findAll(function(err, results) {
			// 에러 발생 시, 클라이언트로 에러 전송
			if (err) {
                console.error('사용자 리스트 조회 중 에러 발생 : ' + err.stack);
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 리스트 조회 중 에러 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
				res.end();
                return;
            }
			  
			if (results) {  // 결과 객체 있으면 리스트 전송
				console.dir(results);
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 리스트</h2>');
				res.write('<div><ul>');
				
				for (var i = 0; i < results.length; i++) {
					var curId = results[i]._doc.id;
					var curName = results[i]._doc.name;
					var curAge = results[i]._doc.age;
					res.write('    <li>#' + i + ' : ' + curId  + ', ' + curAge + '세, ' + curName + '</li>');
				}	
			
				res.write('</ul></div>');
				res.end();
			} else {  // 결과 객체가 없으면 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 리스트 조회  실패</h2>');
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
});


// ***************** photolist 추가 ********************
router.route('/process/photolist').post(function(req, res) {
	console.log('/process/photolist 호출됨.');
	var ops = database.collection('Photos2')
    // 데이터베이스 객체가 초기화된 경우, 모델 객체의 findAll 메소드 호출
	if (database) {
		// 1. 모든 사용자 검색
		ops.find({}, function(err, results) {
			// 에러 발생 시, 클라이언트로 에러 전송
			if (err) {
                console.error('사용자 리스트 조회 중 에러 발생 : ' + err.stack);
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 리스트 조회 중 에러 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
				res.end();
                return;
            }
			  
			if (results) {  // 결과 객체 있으면 리스트 전송
				console.dir(results);
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사진 리스트</h2>');
				res.write('<div><ul>');
				
				for (var i = 0; i < results.length; i++) {
					var curId = results[i]._doc._author;
					var curName = results[i]._doc._contents;
					res.write('    <li>#' + i + ' : ' + curId + ', ' + curName + '</li>');
				}	
			
				res.write('</ul></div>');
				res.end();
			} else {  // 결과 객체가 없으면 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 리스트 조회  실패</h2>');
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
});


router.route('/process/updateuser').post(function(req, res) {
	console.log('/process/updateuser 호출됨.');

    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;
	var paramAge = req.body.age || req.query.age;
	
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword + ', ' + paramName + ', ' + paramAge);
    
    // 데이터베이스 객체가 초기화된 경우, addUser 함수 호출하여 사용자 추가
	if (database) {
		updateUser(database, paramId, paramPassword, paramName, paramAge, function(err, updatedUser) {
            // 동일한 id로 추가하려는 경우 에러 발생 - 클라이언트로 에러 전송
			if (err) {
                console.error('사용자 수정 중 에러 발생 : ' + err.stack);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 수정 중 에러 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
				res.end();
                
                return;
            }
			
            // 결과 객체 있으면 성공 응답 전송
			if (updatedUser) {
				console.dir(updatedUser);
 
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 수정 성공</h2>');
				res.end();
			} else {  // 결과 객체가 없으면 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 수정 실패</h2>');
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
	
});


router.route('/process/deleteUser').post(function(req, res) {
	console.log('/process/deleteUser 호출됨.');

    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword);
    
    // 데이터베이스 객체가 초기화된 경우, addUser 함수 호출하여 사용자 추가
	if (database) {
		deleteUser(database, paramId, paramPassword, function(err, deletedUser) {
            // 동일한 id로 추가하려는 경우 에러 발생 - 클라이언트로 에러 전송
			if (err) {
                console.error('사용자 삭제 중 에러 발생 : ' + err.stack);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 삭제 중 에러 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
				res.end();
                
                return;
            }
			
            // 결과 객체 있으면 성공 응답 전송
			if (deletedUser) {
				console.dir(deletedUser);
 
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 삭제 성공</h2>');
				res.end();
			} else {  // 결과 객체가 없으면 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사용자 삭제 실패</h2>');
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
	
});

// 라우터 객체 등록
app.use('/', router);



// 사용자를 인증하는 함수 : 아이디로 먼저 찾고 비밀번호를 그 다음에 비교하도록 함
var authUser = function(database, id, password, callback) {
	console.log('authUser 호출됨 : ' + id + ', ' + password);
	
    // 1. 아이디를 이용해 검색
	UserModel.findById(id, function(err, results) {
		if (err) {
			callback(err, null);
			return;
		}
		
		console.log('아이디 [%s]로 사용자 검색결과', id);
		console.dir(results);

		// id를 찾았다면 if 문 안에서 패스워드를 확인
		if (results.length > 0) {
			console.log('아이디와 일치하는 사용자 찾음.');
			
			// 2. 패스워드 확인 : 모델 인스턴스를 객체를 만들고 authenticate() 메소드 호출 
			var user = new UserModel({id:id});  // user는 인스턴스.. 객체 아님.. -> method를 써야함. -> 150L에 authenticated는 method로 정의. 시험에 authenticated를 static으로 바꿔낼 가능성 있음
			var authenticated = user.authenticate(password, results[0]._doc.salt, results[0]._doc.hashed_password);
			if (authenticated) {
				console.log('비밀번호 일치함');
				callback(null, results);
			} else {
				console.log('비밀번호 일치하지 않음');
				callback(null, null);
			}
			
		} else {
	    	console.log("아이디와 일치하는 사용자를 찾지 못함.");
	    	callback(null, null);
	    }
		
	});
	
}


//사용자를 추가하는 함수
var addUser = function(database, id, password, name, age, callback) {
	console.log('addUser 호출됨 : ' + id + ', ' + password + ', ' + name + ' ' + age);
	var user = new UserModel({"id":id, "password":password, "name":name, "age": age});
	// save()로 저장 : 저장 성공 시 addedUser 객체가 파라미터로 전달됨
	user.save(function(err, addedUser) {
		if (err) {
			callback(err, null);
			return;
		}
	    console.log("사용자 데이터 추가함.");
	    callback(null, addedUser);
	});
}

var deleteUser = function(database, id, password, callback) {
	console.log('deleteUser 호출됨 : ' + id + ', ' + password);
	
	var user = UserModel.where({"id": id, "passowrd": password});

	user.remove(function(err, deletedUser) {
		if(err) {
			callback(err, null);
			return;
		}
		console.log("사용자 데이터 삭제함.");
		callback(null, deletedUser);
	})
}

var updateUser = function(database, id, password, name, age, callback) {
	console.log('updateUser 호출됨 : ' + id + ', ' + password);
	
	var user = UserModel.where({"id": id, "passowrd": password});

	user.update({"name": name , "age": age}, function(err, updatedUser) {
		if(err) {
			callback(err, null);
			return;
		}
		console.log("사용자 수정함.");
		callback(null, updateUser);
	})	
}

var storage = multer.diskStorage({
	destination: function (req, file, callback) {
		callback(null, './uploads')
	},
	filename: function (req, file, callback) {
		var extension = path.extname(file.originalname);
		var basename = path.basename(file.originalname, extension);
		callback(null, basename + Date.now() + extension);
	}
  });
  
  var upload = multer({ 
	storage: storage,
	limits: {
	files: 10,
	fileSize: 1024 * 1024 * 1024
  }
  });


router.route('/process/save').post(upload.array('photo', 1), function(req, res) {
	console.log("/process/save 호출됨.");
	// 요청 파라미터 확인
	var paramAuthor = req.body.author || req.query.author;
	var paramCreateDate = req.body.createDate || req.query.createDate;
	var paramContents = req.body.contents || req.query.contents;
	console.log("요청 파라미터 : " + paramAuthor + ", " + paramCreateDate + ", " + paramContents);
	var files = req.files;
		// 현재의 파일 정보를 저장할 변수 선언
		var originalname = '',
		paramPhoto = '',
			  mimetype = '',
			  size = 0;
		  if (Array.isArray(files)) {   // 배열에 들어가 있는 경우 (설정에서 1개의 파일도 배열에 넣게 했음)
			  console.log("배열에 들어있는 파일 갯수 : %d", files.length);
			  
			  for (var index = 0; index < files.length; index++) {
				  originalname = files[index].originalname;
				  paramPhoto = files[index].filename;
				  mimetype = files[index].mimetype;
				  size = files[index].size;
			  }
			  console.log('현재 파일 정보 : ' + originalname + ', ' + paramPhoto + ', ' + mimetype + ', ' + size);
	  } else {
			console.log('업로드된 파일이 배열에 들어가 있지 않습니다.');
	  }
	
  
	// 데이터베이스 객체가 초기화된 경우, addPhoto 함수 호출하여 사진 추가
	if (database) {
		addPhoto(paramAuthor, paramCreateDate, paramContents, paramPhoto, function (err, result) {
		  if (err) {
			throw err;
		  }
  
		  if (result && result.insertedCount > 0) {
			console.log("===== result의 내용 시작 =====");
			console.dir(result);
			console.log("===== result의 내용 끝 =====");
  
			res.writeHead("200", { "Content-Type": "text/html;charset=utf8" });

			res.write("새로운 사진이 등록되었습니다..<br>");
			res.write(`작성자 : ${paramAuthor}<br>`);
			res.write(`번호 : ${paramCreateDate}<br>`);
			res.write(`설명 : ${paramContents}<br>`);
			res.write(`<img src="/uploads/${paramPhoto}" alt="" style="width: 200px; height: 100px;"><br>`);
			res.write(`<a href="/addphoto.html">다시 작성</a>`);
			res.end();
		  } else {
			// 결과 객체가 없으면 실패 응답 전송
			res.writeHead("200", { "Content-Type": "text/html;charset=utf8" });
			res.write("<h2>메모 추가  실패</h2>");
			res.end();
		  }
		});
	} else {
	  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
	  res.writeHead("200", { "Content-Type": "text/html;charset=utf8" });
	  res.write("<h2>데이터베이스 연결 실패</h2>");
	  res.end();
	}
  });

  // ***************** addPhoto 함수 ************************** //
var addPhoto = function(author, contents, createDate, photo, callback) {
	console.log('addPhoto 호출됨 : ' + author + ', ' + contents + ', ' + createDate + ', ' + photo);
	  var ops = database.collection('Photos2'); 
  
	  ops.insertMany([{"author":author, "contents":contents, "createDate":createDate, "photo":photo}], 
	  function(err, result) { 
		if (err) { 
			callback(err, null); 
			return; 
		} 
		if (result.insertedCount > 0) { 
			console.log("사용자 레코드 추가됨 : " + result.insertedCount); 
		} 
		else { 
			console.log("추가된 레코드가 없음."); 
		} 
		callback(null, result); 
	});
  };


// *************** DELETE PHOTO ***********************//

router.route('/process/deletePhoto').post(function(req, res) {
	console.log('/process/deletePhoto 호출됨.');
	var paramId = req.body.id || req.query.id;
	var paramDate = req.body.date || req.query.date;

	console.log('요청 파라미터 : ' + paramId + ', ' + paramDate);

	if(database) {
		deletePhoto(database, paramId, paramDate, function(err, deletePhoto) {
			if(err) {
				console.error('사진 삭제 중 에러 발생: ', err.stack);

				res.writeHead('<h2>사진 삭제 중 에러 발생</h2>');
				res.writeHead('<p>' + err.stack + '</p>');
				res.end();
				return;
			}

			if(deletePhoto) {
				console.dir(deletePhoto);
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사진 삭제 성공</h2>');
				res.end();
			} else {  // 결과 객체가 없으면 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사진 삭제 실패</h2>');
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
})

var deletePhoto = function(database, id, date, callback) {
	console.log('deletePhoto 호출됨 : ' + id + ', ' + date);

	var ops = database.collection('Photos2');
	ops.deleteOne({"author": id, "contents": date}, function(err, result) {
		if(err) {
			callback(err, null);
			return;
		}
		if(result.deleteCount > 0) {
			console.log("사진 삭제됨 : " + result.deleteCount);
		}
		else {
			console.log("삭제된 사진 없음.");
		}
		callback(null, result);
	});
}

// **********************Update Photo *************************//


router.route('/process/updatePhoto').post(function(req, res) {
	console.log('/process/updatePhoto 호출됨.');
	var paramId = req.body.id || req.query.id;
	var paramDate = req.body.date || req.query.date;
	var paramText = req.body.text || req.query.text;

	console.log('요청 파라미터 : ' + paramId + ', ' + paramDate + ', ' + paramText);

	if(database) {
		updatePhoto(database, paramId, paramDate, paramText, function(err, updatePhoto) {
			if(err) {
				console.error('사진 수정 중 에러 발생: ', err.stack);

				res.writeHead('<h2>사진 수정 중 에러 발생</h2>');
				res.writeHead('<p>' + err.stack + '</p>');
				res.end();
				return;
			}

			if(updatePhoto) {
				console.dir(updatePhoto);
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사진 수정 성공</h2>');
				res.end();
			} else {  // 결과 객체가 없으면 실패 응답 전송
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h2>사진 수정 실패</h2>');
				res.end();
			}
		});
	} else {  // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}
})


var updatePhoto = function(database, id, date, text, callback) {
	console.log('updatePhoto 호출됨 : ' + id + ', ' + date + ', ' + text);

	var ops = database.collection('Photos2');
	ops.updateOne({"author": id, "contents": date}, {$set:{"createDate": text}}, function(err, result) {
		if(err) {
			callback(err, null);
			return;
		}
		if(result.deleteCount > 0) {
			console.log("사진 설명 수정됨 : " + result.updateCount);
		}
		else {
			console.log("수정된 사진 설명 없음.");
		}
		callback(null, result);
	});
}


// 404 에러 페이지 처리
var errorHandler = expressErrorHandler({
 static: {
   '404': './public/404.html'
 }
});

app.use( expressErrorHandler.httpError(404) );
app.use( errorHandler );


//===== 서버 시작 =====//

// 프로세스 종료 시에 데이터베이스 연결 해제
process.on('SIGTERM', function () {
    console.log("프로세스가 종료됩니다.");
    app.close();
});

app.on('close', function () {
	console.log("Express 서버 객체가 종료됩니다.");
	if (database) {
		database.close();
	}
});

// Express 서버 시작
http.createServer(app).listen(app.get('port'), function(){
  console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));

  // 데이터베이스 연결을 위한 함수 호출
  connectDB();
   
});
