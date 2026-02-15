export const translations = {
  en: {
    // Welcome Screen
    'welcome.title': 'Welcome!',
    'welcome.name': "What's your name?",
    'welcome.age': 'How old are you?',
    'welcome.start': "Let's Start Learning!",
    
    // Dashboard
    'dashboard.hello': 'Hello',
    'dashboard.points': 'points',
    'dashboard.activities': 'activities',
    'dashboard.homework': 'Homework Help',
    
    // Subjects
    'subject.reading': 'Reading',
    'subject.writing': 'Writing',
    'subject.math': 'Math',
    'subject.spelling': 'Spelling',
    'subject.social': 'Social Skills',
    'subject.logic': 'Logic & Reasoning',
    'subject.languages': 'Languages',
    
    // Common
    'common.next': 'Next',
    'common.back': 'Back',
    'common.submit': 'Submit',
    'common.done': 'Done',
  },
  
  vi: {
    // Welcome Screen
    'welcome.title': 'Chào mừng!',
    'welcome.name': 'Tên bạn là gì?',
    'welcome.age': 'Bạn bao nhiêu tuổi?',
    'welcome.start': 'Bắt đầu học!',
    
    // Dashboard
    'dashboard.hello': 'Xin chào',
    'dashboard.points': 'điểm',
    'dashboard.activities': 'hoạt động',
    'dashboard.homework': 'Trợ giúp bài tập',
    
    // Subjects
    'subject.reading': 'Đọc',
    'subject.writing': 'Viết',
    'subject.math': 'Toán',
    'subject.spelling': 'Đánh vần',
    'subject.social': 'Kỹ năng xã hội',
    'subject.logic': 'Logic & Lý luận',
    'subject.languages': 'Ngôn ngữ',
    
    // Common
    'common.next': 'Tiếp theo',
    'common.back': 'Quay lại',
    'common.submit': 'Gửi',
    'common.done': 'Xong',
  },
  
  es: {
    'welcome.title': '¡Bienvenido!',
    'welcome.name': '¿Cómo te llamas?',
    'welcome.age': '¿Cuántos años tienes?',
    'welcome.start': '¡Empecemos a Aprender!',
    
    'dashboard.hello': 'Hola',
    'dashboard.points': 'puntos',
    'dashboard.activities': 'actividades',
    
    'subject.reading': 'Lectura',
    'subject.writing': 'Escritura',
    'subject.math': 'Matemáticas',
    'subject.spelling': 'Ortografía',
    'subject.social': 'Habilidades Sociales',
    'subject.logic': 'Lógica y Razonamiento',
    'subject.languages': 'Idiomas',
  },
  
  zh: {
    'welcome.title': '欢迎！',
    'welcome.name': '你叫什么名字？',
    'welcome.age': '你几岁了？',
    'welcome.start': '开始学习！',
    
    'dashboard.hello': '你好',
    'dashboard.points': '分',
    'dashboard.activities': '活动',
    
    'subject.reading': '阅读',
    'subject.writing': '写作',
    'subject.math': '数学',
    'subject.spelling': '拼写',
    'subject.social': '社交技能',
    'subject.logic': '逻辑推理',
    'subject.languages': '语言',
  }
  // Add more languages...
};

export const t = (key, lang = 'en') => {
  return translations[lang]?.[key] || translations['en'][key] || key;
};