const API_URL = "http://shop-roles.node.ed.asmer.org.ua/graphql";

function getGql(url) {
  return (query, variables = {}) => {
    const token = store.getState().auth.token;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      },
      body: JSON.stringify({
        query,
        variables
      }),
    }).then(response => response.json()).then(response => {
      if (response.data) {
        return Object.values(response.data)[0];
      } else if (response.errors) {
        throw new Error(JSON.stringify(response.errors));
      }
    });
  }
}

const gql = getGql(API_URL);

function createStore(reducer) {
  let state = reducer(undefined, {}); //стартовая инициализация состояния, запуск редьюсера со state === undefined
  let cbs = [];                     //массив подписчиков

  const getState = () => state;            //функция, возвращающая переменную из замыкания
  const subscribe = cb => (cbs.push(cb),   //запоминаем подписчиков в массиве
    () => cbs = cbs.filter(c => c !== cb)); //возвращаем функцию unsubscribe, которая удаляет подписчика из списка

  const dispatch = action => {
    if (typeof action === 'function') { //если action - не объект, а функция
      return action(dispatch, getState); //запускаем эту функцию и даем ей dispatch и getState для работы
    }
    const newState = reducer(state, action); //пробуем запустить редьюсер
    if (newState !== state) { //проверяем, смог ли редьюсер обработать action
      state = newState; //если смог, то обновляем state 
      for (let cb of cbs) cb(state); //и запускаем подписчиков
    }
  }

  return {
    getState, //добавление функции getState в результирующий объект
    dispatch,
    subscribe //добавление subscribe в объект
  }
}

function combineReducers(reducers) {
  function totalReducer(state = {}, action) {
    const newTotalState = {};
    for (const [reducerName, reducer] of Object.entries(reducers)) {
      const newSubState = reducer(state[reducerName], action);
      if (newSubState !== state[reducerName]) {
        newTotalState[reducerName] = newSubState;
      }
    }
    if (Object.keys(newTotalState).length) {
      return { ...state, ...newTotalState };
    }
    return state;
  }

  return totalReducer;
}

const reducers = {
  promise: promiseReducer, //допилить много имен для многих промисо
  auth: authReducer,     //часть предыдущего ДЗ
  cart: cartReducer,     //часть предыдущего ДЗ
}

const totalReducer = combineReducers(reducers);

function promiseReducer(state = {}, { key, type, status, payload, error }) {
  if (type === 'PROMISE') {
    return { ...state, [key]: { status, payload, error } };
  }
  return state;
}

const actionPending = (key) => ({ key, type: 'PROMISE', status: 'PENDING' });
const actionFulfilled = (key, payload) => ({ key, type: 'PROMISE', status: 'FULFILLED', payload });
const actionRejected = (key, error) => ({ key, type: 'PROMISE', status: 'REJECTED', error });

const actionPromise = (key, promise) =>
  async dispatch => {
    dispatch(actionPending(key)); //сигнализируем redux, что промис начался
    try {
      const payload = await promise; //ожидаем промиса
      dispatch(actionFulfilled(key, payload)); //сигнализируем redux, что промис успешно выполнен
      return payload; //в месте запуска store.dispatch с этим thunk можно так же получить результат промиса
    }
    catch (error) {
      dispatch(actionRejected(key, error)); //в случае ошибки - сигнализируем redux, что промис несложился
      main.innerHTML = '<div style="background-color:red; width:500px; height:500px"></div>';
    }
  }

function authReducer(state = {}, { type, token }) {
  if (type === 'AUTH_LOGIN') {
    try {
      let mediumStr = token.split('.')[1];
      let result = JSON.parse(atob(mediumStr));
      return { ...state, 'token': token, 'payload': result };
    } catch (e) {
      return {};
    }
  }
  if (type === 'AUTH_LOGOUT') {
    return {};
  }
  return state;
}

const actionAuthLogin = token => ({ type: 'AUTH_LOGIN', token });
const actionAuthLogout = () => ({ type: 'AUTH_LOGOUT' });

function cartReducer(state = {}, { type, good, count }) {
  let goodKey, oldCount, goodValue;
  if (good) {
    goodKey = good['_id'];
    oldCount = state[goodKey]?.count || 0;
    goodValue = { good, count: oldCount };
  }
  if (type === 'CART_ADD') {
    goodValue.count += +count;
    return { ...state, [goodKey]: goodValue };
  } else if (type === 'CART_SUB') {
    goodValue.count -= +count;
    if (goodValue.count <= 0) {
      delete state[goodKey];
      return { ...state };
    }
    return { ...state, [goodKey]: goodValue };
  } else if (type === 'CART_DEL') {
    delete state[goodKey];
    return { ...state };
  } else if (type === 'CART_SET') {
    goodValue.count = +count;
    if (goodValue.count <= 0) {
      delete state[goodKey];
      return { ...state };
    }
    return { ...state, [goodKey]: goodValue };
  } else if (type === 'CART_CLEAR') {
    return {};
  }
  return state;
}

const actionCartAdd = (good, count = 1) => ({ type: 'CART_ADD', count, good });
const actionCartSub = (good, count = 1) => ({ type: 'CART_SUB', count, good });
const actionCartDel = (good) => ({ type: 'CART_DEL', good });
const actionCartSet = (good, count = 1) => ({ type: 'CART_SET', count, good });
const actionCartClear = () => ({ type: 'CART_CLEAR' });

function localStoredReducer(originalReducer, localStorageKey) {
  function wrapper(state, action) {
    if (state === undefined) {
      try {
        let savedState = JSON.parse(localStorage[localStorageKey]);
        return savedState;
      } catch (e) {
      }
    }
    let newState = originalReducer(state, action);
    localStorage.setItem(localStorageKey, JSON.stringify(newState));
    return newState;
  }
  return wrapper;
}


const store = createStore(localStoredReducer(totalReducer, 'total'));

store.subscribe(() => console.log(store.getState()));

function drawTitle(name) {
  let nameEl = document.createElement('div');
  main.append(nameEl);
  nameEl.innerText = name;
  nameEl.classList.add('title');
}

function drawCategoriesSection(categories, categoryEl) {
  let containerEl = document.createElement('section');
  main.append(containerEl);
  containerEl.innerText = categoryEl;
  containerEl.classList.add('info-about-category');
  for (const category of categories) {
    let categoryName = document.createElement('a');
    categoryName.classList.add('link-style');
    containerEl.append(categoryName);
    categoryName.href = `#/category/${category._id}`;
    categoryName.innerText = category.name;
  }
}

function drawImage(parent, url, route, id) {
  let imageContainer = document.createElement('div');
  parent.append(imageContainer);
  if (route == 'category') {
    imageContainer.addEventListener('click', (e) => location.href = `#/good/${id}`);
  }
  imageContainer.classList.add('image-container');
  let goodImage = document.createElement('img');
  imageContainer.append(goodImage);
  goodImage.classList.add('good-image');
  goodImage.src = 'http://shop-roles.node.ed.asmer.org.ua/' + url;
}

function drawSum(parent, priceText) {
  let sumEl = document.createElement('div');
  parent.append(sumEl);
  sumEl.classList.add('price');
  sumEl.innerText = priceText;
}

function drawCounter(parent, value) {
  let counterEl = document.createElement('input');
  parent.append(counterEl);
  counterEl.type = 'number';
  counterEl.min = 1;
  counterEl.value = value;
  return counterEl;
}

function drawAddButton(parent) {
  let cartAddButton = document.createElement('button');
  parent.append(cartAddButton);
  cartAddButton.innerText = 'Add to cart';
  cartAddButton.classList.add('button');
  return cartAddButton;
}

function drawDelButton(parent) {
  let cartDelButton = document.createElement('button');
  parent.append(cartDelButton);
  cartDelButton.innerText = 'Delete from cart';
  cartDelButton.classList.add('button');
  return cartDelButton;
}

const drawCategory = () => {
  const [, route] = location.hash.split('/');
  if (route !== 'category') return;
  let status, payload, error;
  if (store.getState().promise.category) {
    ({ status, payload, error } = store.getState().promise.category);
  }
  if (status === 'PENDING') {
    main.innerHTML = `<img src='images/pending.jpeg'>`;
  }
  if (status === 'FULFILLED') {
    main.innerHTML = '';
    const { name, subCategories, parent, goods } = payload;
    drawTitle(name);
    if (subCategories?.length > 0) {
      drawCategoriesSection(subCategories, 'Subcategories: ');
    }
    if (parent) {
      drawCategoriesSection([parent], 'Parent category: ');
    }
    if (goods?.length > 0) {
      let goodsContainer = document.createElement('section');
      main.append(goodsContainer);
      goodsContainer.classList.add('goods-container');

      for (const good of goods) {
        let goodCart = document.createElement('div');
        goodsContainer.append(goodCart);
        goodCart.classList.add('good-cart');
        let goodName = document.createElement('a');
        goodCart.append(goodName);
        goodName.href = `#/good/${good._id}`;
        goodName.innerText = good.name;
        if (good.images?.length > 0) {
          drawImage(goodCart, good.images[0].url, route, good._id);
        }
        if (good.price) {
          drawSum(goodCart, `${good.price} UAH`);
        }
        let goodCountEl = drawCounter(goodCart, 1);
        let cartAddButton = drawAddButton(goodCart);
        let cartDelButton = drawDelButton(goodCart);
        cartAddButton.addEventListener('click', event => {
          store.dispatch(actionCartAdd(good, goodCountEl.value));
        });
        cartDelButton.addEventListener('click', event => {
          store.dispatch(actionCartDel(good));
        });
      }
    } else {
      main.innerHTML += `<div class="goods-out-stock">Goods out of stock</div>`;
    }

  }
}

store.subscribe(() => drawCategory());

function LoginForm(parent) {
  parent.innerHTML = '';
  if (location.hash == '#/login') {
    let loginTitle = document.createElement('div');
    parent.append(loginTitle);
    loginTitle.classList.add('title');
    loginTitle.innerText = 'Account login';
  } else if (location.hash == '#/register') {
    let registerTitle = document.createElement('div');
    parent.append(registerTitle);
    registerTitle.classList.add('title');
    registerTitle.innerText = 'Registration';
  }
  let form = document.createElement('form');
  parent.append(form);
  form.classList.add('form');
  let loginLabel = document.createElement('label');
  loginLabel.innerText = 'Login: ';
  form.append(loginLabel);
  let login = new Login(form);
  let passwordLabel = document.createElement('label');
  passwordLabel.innerText = 'Password: ';
  form.append(passwordLabel);
  let password = new Password(form, false);
  let submit = document.createElement('button');
  submit.classList.add('button');
  submit.innerText = 'Submit';
  form.append(submit);
  this.validateForm = () => {
    if (login.getValue() == '' || password.getValue() == '') {
      submit.disabled = true;
    } else {
      submit.disabled = false;
      if (this.onValidForm) {
        this.onValidForm();
      }
    }
  }
  submit.addEventListener('click', (e) => {
    e.preventDefault();
    if (this.onSubmitForm) {
      this.onSubmitForm();
    }
  });
  this.getLoginValue = () => {
    return login.getValue();
  }
  this.setLoginValue = (value) => {
    login.setValue(value);
  }
  this.getPasswordValue = () => {
    return password.getValue();
  }
  this.setPasswordValue = (value) => {
    password.setValue(value);
  }
  this.validateForm();
  login.onChange = this.validateForm;
  password.onChange = this.validateForm;
}

function Login(parent) {
  let loginInputEl = document.createElement('input');
  loginInputEl.type = 'text';
  parent.append(loginInputEl);
  loginInputEl.addEventListener('input', (event) => {
    if (this.onChange) {
      this.onChange();
    }
  });
  this.setValue = (value) => {
    loginInputEl.value = value;
  }
  this.getValue = () => {
    return loginInputEl.value;
  }
}
function Password(parent, open) {
  let passInputEl = document.createElement('input');
  parent.append(passInputEl);
  let passVisibilityCheckboxEl = document.createElement('input');
  passVisibilityCheckboxEl.type = 'checkbox';
  passVisibilityCheckboxEl.checked = open;
  parent.append(passVisibilityCheckboxEl);
  if (open) {
    passInputEl.type = 'text';
  } else {
    passInputEl.type = 'password';
  }
  passVisibilityCheckboxEl.addEventListener('change', (event) => {
    if (event.currentTarget.checked) {
      passInputEl.type = 'text';
    } else {
      passInputEl.type = 'password';
    }
    if (this.onOpenChange) {
      this.onOpenChange(event.currentTarget.checked);
    }
  });
  passInputEl.addEventListener('input', (event) => {
    if (this.onChange) {
      this.onChange();
    }
  });
  this.setValue = (value) => {
    passInputEl.value = value;
  }
  this.getValue = () => {
    return passInputEl.value;
  }
  this.setOpen = (value) => {
    passVisibilityCheckboxEl.checked = value;
  }
  this.getOpen = () => {
    return passVisibilityCheckboxEl.checked;
  }
}

function drawLoginForm() {
  const form = new LoginForm(main);
  form.onSubmitForm = () =>
    store.dispatch(actionFullLogin(form.getLoginValue(), form.getPasswordValue()));

}

store.subscribe(() => {
  const [, route] = location.hash.split('/');
  if (route !== 'login') return;
  let status, payload, error;
  if (store.getState().promise?.login) {
    ({ status, payload, error } = store.getState().promise?.login);
  }
  if (status === 'FULFILLED') {
    if (payload) {
      location.hash = '';
      main.innerHTML = '';
    } else {
      let errorMessageEl = document.createElement('div');
      main.append(errorMessageEl);
      errorMessageEl.innerText = 'You entered wrong login or password';
    }
  }

})

store.subscribe(() => {
  // header update
  userName.innerText = 'Hello, ' + (store.getState().auth.payload?.sub?.login || "anon");
  login.hidden = store.getState().auth.token;
  registration.hidden = store.getState().auth.token;
  logout.hidden = !(store.getState().auth.token);
  historyPage.hidden = !(store.getState().auth.token);
});

function drawRegisterForm() {
  const form = new LoginForm(main);
  form.onSubmitForm = () =>
    store.dispatch(actionFullRegister(form.getLoginValue(), form.getPasswordValue()));
}

const drawGood = () => {
  const [, route] = location.hash.split('/');
  if (route !== 'good') return;

  let status, payload, error;
  if (store.getState().promise.good) {
    ({ status, payload, error } = store.getState().promise.good);
  }
  if (status === 'PENDING') {
    main.innerHTML = `<img src='images/pending.jpeg'>`;
  }
  if (status === "FULFILLED") {
    main.innerHTML = '';
    const { name, images, categories, price, description, _id } = payload;
    drawTitle(name);
    if (categories?.length > 0) {
      drawCategoriesSection(categories, 'Category: ');
    }
    let goodSection = document.createElement('section');
    main.append(goodSection);
    goodSection.classList.add('good-section');
    let imagesContainer = document.createElement('div');
    goodSection.append(imagesContainer);
    if (images.length > 0) {
      for (const image of images) {
        drawImage(imagesContainer, image.url);
      }
    }
    let goodInfo = document.createElement('div');
    goodSection.append(goodInfo);
    goodInfo.classList.add('good-info');
    if (description) {
      let descriptionEl = document.createElement('div');
      goodInfo.append(descriptionEl);
      descriptionEl.innerText = description;
      descriptionEl.classList.add('description');
    }
    if (price) {
      drawSum(goodInfo, `${price} UAH`);
    }
    let goodCountEl = drawCounter(goodInfo, 1);
    let buttonsContainer = document.createElement('div');
    goodInfo.append(buttonsContainer);
    buttonsContainer.classList.add('buttons-container');
    let cartAddButton = drawAddButton(buttonsContainer);
    let cartDelButton = drawDelButton(buttonsContainer);
    cartAddButton.addEventListener('click', event => {
      store.dispatch(actionCartAdd(payload, goodCountEl.value));
    });
    cartDelButton.addEventListener('click', event => {
      store.dispatch(actionCartDel(payload));
    });
  }

}

store.subscribe(() => drawGood());

function drawGoodsOrderContainer(parent, orderNameValue) {
  let goodsOrderContainer = document.createElement('div');
  parent.append(goodsOrderContainer);
  goodsOrderContainer.classList.add('order-container');
  let orderName = document.createElement('div');
  goodsOrderContainer.append(orderName);
  orderName.innerText = orderNameValue;
  return goodsOrderContainer;
}

function drawTotalAmount(parent) {
  let totalAmountEl = document.createElement('div');
  parent.append(totalAmountEl);
  totalAmountEl.classList.add('price');
  totalAmountEl.classList.add('total-amount');
  return totalAmountEl;
}

const drawOrderHistory = () => {
  const [, route] = location.hash.split('/');
  if (route !== 'history') return;

  let status, payload, error;
  if (store.getState().promise.history) {
    ({ status, payload, error } = store.getState().promise.history);
  }
  if (status === 'PENDING') {
    main.innerHTML = `<img src='images/pending.jpeg'>`;
  }
  if (status === 'FULFILLED') {
    main.innerHTML = '';
    drawTitle('My orders');
    payload = payload.filter(order => order.orderGoods?.every(item => item)).reverse();
    payload.forEach(order => {
      let finalSum = 0;
      const { orderGoods, _id, total } = order;
      if (orderGoods.length > 0) {
        let orderContainer = drawGoodsOrderContainer(main, `Order: ${_id}`);
        for (orderGood of orderGoods) {
          if (orderGood?.good?.name && orderGood?.count && orderGood?.price) {
            let orderGoodName = document.createElement('div');
            orderContainer.append(orderGoodName);
            orderGoodName.innerText = `Good: ${orderGood?.good?.name}`;
            let goodCount = document.createElement('div');
            orderContainer.append(goodCount);
            goodCount.innerText = `Count: ${orderGood?.count}`;
            drawSum(orderContainer, `${orderGood?.price} UAH`);
          }
          if (orderGood?.count && orderGood?.price) {
            finalSum += orderGood?.count * orderGood?.price;
          }
        }
        let totalAmountEl = drawTotalAmount(orderContainer);
        if (total > 0) {
          totalAmountEl.innerText += `Total amount: ${total} UAH`;
        } else {
          totalAmountEl.innerText += `Total amount: ${finalSum} UAH`;
        }
      }
    });
  }
}

store.subscribe(() => drawOrderHistory());

const drawCartPage = () => {
  const [, route] = location.hash.split('/');
  if (route !== 'cart') return;

  if (!(Object.values(store.getState().cart).length > 0)) {
    main.innerHTML = '<div class="cart-is-empty">Cart is empty</div>';
  } else {
    main.innerHTML = '';
    let totalAmount = 0;
    let orderArray = [];
    drawTitle('Cart');
    for (const goodOnCart of Object.values(store.getState().cart)) {
      const { good, count } = goodOnCart;
      let goodContainer = drawGoodsOrderContainer(main, `${good.name} (${good._id})`);
      drawSum(goodContainer, `${good.price} UAH`);
      let countContainer = document.createElement('div');
      goodContainer.append(countContainer);
      countContainer.classList.add('count-container');
      let countText = document.createElement('div');
      countContainer.append(countText);
      countText.innerText = 'Count: ';
      let decreaseCountEl = document.createElement('button');
      countContainer.append(decreaseCountEl);
      decreaseCountEl.classList.add('icon-container');
      let decreaseImg = document.createElement('img');
      decreaseCountEl.append(decreaseImg);
      decreaseImg.src = 'images/minus.png';
      let goodCountEl = drawCounter(countContainer, count);
      let increaseCountEl = document.createElement('button');
      countContainer.append(increaseCountEl);
      increaseCountEl.classList.add('icon-container');
      let increaseImg = document.createElement('img');
      increaseCountEl.append(increaseImg);
      increaseImg.src = 'images/plus.png';
      //total good sum
      drawSum(goodContainer, `Total: ${count * good.price} UAH`);
      totalAmount += count * good.price;
      goodCountEl.addEventListener('change', e => {
        store.dispatch(actionCartSet(good, goodCountEl.value));
      })
      decreaseCountEl.addEventListener('click', e => {
        store.dispatch(actionCartSub(good));
      });
      increaseCountEl.addEventListener('click', e => {
        store.dispatch(actionCartAdd(good));
      })
    }
    orderArray = Object.values(store.getState().cart).map(value => {
      return {
        good: { _id: value.good._id },
        count: value.count
      }
    });
    let totalAmountEl = drawTotalAmount(main);
    totalAmountEl.innerText = `Total sum: ${totalAmount} UAH`;
    let createOrderButton = document.createElement('button');
    main.append(createOrderButton);
    createOrderButton.classList.add('button');
    createOrderButton.classList.add('order-button');
    createOrderButton.innerText = 'Checkout';
    let warningMessage = document.createElement('div');
    main.append(warningMessage);
    warningMessage.classList.add('warning-message');
    warningMessage.innerText = 'You need to login or register to place an order';
    if (store.getState().auth.token) {
      createOrderButton.addEventListener('click', e => {
        store.dispatch(actionOrder(orderArray));
      });
    } else {
      createOrderButton.addEventListener('click', e => {
        warningMessage.style.display = 'block';
      });
    }
  }
}

let cartIcon = document.querySelector("img.cart-icon");
cartIcon.addEventListener('click', () => location.href = `#/cart`);
store.subscribe(() => drawCartPage());
store.subscribe(() => {
  let sumTotal = 0;
  for (let { count } of Object.values(store.getState().cart)) {
    sumTotal += count;
  }
  cartIconEl.innerText = sumTotal;
});

const gqlGetCategories = () => {
  const categoriesQuery = `query categories($q: String){
    CategoryFind(query: $q){
      _id
      name,
      goods{
        name
      },
      parent{
        name
      },
      image{
        url
      },
      subCategories{
        name,
        subCategories{
          name
        }
      }
    }
}`;
  return gql(categoriesQuery, { q: "[{\"parent\": null}]" });
}

const gqlGetCategory = (id) => {
  const categoryQuery = `query category($q: String) {
    CategoryFindOne(query: $q) {
      _id
      name,
      goods{
        name,
        _id,
        images{
          _id,
          url
        },
        price
      },
      parent {
        _id,
        name
      },
      subCategories{
        name,
        _id
        subCategories{
          name,
          _id
        }
      }
    }
}`;
  return gql(categoryQuery, { q: `[{"_id": "${id}"}]` });
}

const gqlGetGood = (id) => {
  const goodQuery = `query good($q: String) {
    GoodFindOne(query: $q) {
      _id,
      name,
      categories{
        _id,
        name
      },
      description,
      price,
      images{
        _id,
        url
      }
    }
}`;
  return gql(goodQuery, { q: `[{"_id": "${id}"}]` });
}

const gqlLogin = (login, password) => {
  const loginQuery = `query login($login:String, $password:String){
    login(login:$login, password:$password)
}`;
  return gql(loginQuery, { login, password });
}

const gqlCreateUser = (login, password) => {
  const registrationQuery = `mutation registration($login:String, $password: String){
    UserUpsert(user: {login:$login, password: $password}){
        _id login createdAt
    }
}`;
  return gql(registrationQuery, { login, password });
}

const gqlGetOwnerOrders = () => {
  const ordersQuery = `query orders($q: String) {
    OrderFind(query: $q) {
      _id, total, owner{
        _id, login
      }, orderGoods{
        price, count, good{
          name
        }
      }
    }
  }`;
  return gql(ordersQuery, { q: `[{}]` });
}

const gqlCreateOrder = (orderGoods) => {
  const orderQuery = `mutation ordering($orderGoods: OrderInput) {
    OrderUpsert(order: $orderGoods) {
      _id, total, orderGoods {
        good {
          name
        }
      }
    }
  }`;
  return gql(orderQuery, { orderGoods: { orderGoods } });
}

const actionCategories = () =>
  actionPromise('categories', gqlGetCategories());

const actionCategoryById = (id) =>
  actionPromise('category', gqlGetCategory(id));

const actionGoodById = (id) =>
  actionPromise('good', gqlGetGood(id));

const actionLogin = (login, password) =>
  actionPromise('login', gqlLogin(login, password));

const actionCreateUser = (login, password) =>
  actionPromise('register', gqlCreateUser(login, password));

const actionOwnerOrders = () =>
  actionPromise('history', gqlGetOwnerOrders());

const actionCreateOrder = (orderGoods) =>
  actionPromise('cart', gqlCreateOrder(orderGoods));

const actionFullLogin = (login, password) =>
  async dispatch => {
    //dispatch возвращает то, что вернул thunk, возвращаемый actionLogin, а там промис, 
    //так как actionPromise возвращает асинхронную функцию
    const token = await dispatch(actionLogin(login, password))
    //проверьте что token - строка и отдайте его в actionAuthLogin
    console.log(token);
    if (typeof token === 'string') {
      dispatch(actionAuthLogin(token));
    }
  }

const actionFullRegister = (login, password) =>
  async dispatch => {
    await dispatch(actionCreateUser(login, password));
    dispatch(actionFullLogin(login, password));
  }

const actionOrder = (orderGoods) =>
  async dispatch => {
    await dispatch(actionCreateOrder(orderGoods));
    console.log('order was created');
    dispatch(actionCartClear());
  }


store.dispatch(actionCategories());

store.subscribe(() => {
  const { status, payload, error } = store.getState().promise.categories;
  if (status === 'FULFILLED' && payload) {
    aside.innerHTML = '';
    for (const { _id, name } of payload) {
      aside.innerHTML += `<a href="#/category/${_id}">${name}</a>`;
    }
  }
});

store.subscribe(() => {
  const [, route] = location.hash.split('/');
  if (!route) {
    main.innerHTML = `<img class='banner-image' src='images/welcome.png'>`;
  }
})

logout.addEventListener('click', event => {
  store.dispatch(actionAuthLogout());
  store.dispatch(actionCartClear());
});

window.onhashchange = () => {
  const [, route, _id] = location.hash.split('/');

  const routes = {
    category() {
      store.dispatch(actionCategoryById(_id));
    },
    good() {
      store.dispatch(actionGoodById(_id));
      console.log('good', _id);
    },
    login() {
      console.log('А ТУТ ЩА ДОЛЖНА БЫТЬ ФОРМА ЛОГИНА');
      drawLoginForm();
    },
    register() {
      drawRegisterForm();
    },
    history() {
      store.dispatch(actionOwnerOrders());
      console.log('history page');
    },
    cart() {
      console.log('cart page');
      drawCartPage();
    }
  }

  if (route in routes) {
    routes[route]();
  }
}

window.onhashchange();