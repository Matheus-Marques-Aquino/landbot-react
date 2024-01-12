import React, { useState, useEffect, useRef } from 'react';
import Core from '@landbot/core';

import Datepicker from "react-tailwindcss-datepicker";
import Tooltip from './widgets/Tooltip';

const messageTypes = ['text', 'dialog', 'multi_question', 'media_dialog', 'image', 'iframe', 'hidden', 'unknown'];

const formInputTypes = ['date', 'tel', 'email', 'number', 'text', 'autocomplete', 'media_dialog'];

function parseMessage(data) {
  return {
    ...data,
    key: data.key,
    text: data.title || data.message,
    author: data.samurai !== undefined ? 'bot' : 'user',
    timestamp: data.timestamp,
    type: data.type,
  };
}

function parseMessages(messages) {
  return Object.values(messages).reduce((obj, next) => {
    obj[next.key] = parseMessage(next);
    return obj;
  }, {});
}

function messagesFilter(data) {
  /** Support for basic message types */
  return ['text', 'dialog', 'multi_question', 'media_dialog'].includes(data.type);
}

function getMessageType(data) {
  return messageTypes.includes(data.type) ? data.type : 'unknown';
}

function getMessageField(data) {
  var field = 'unknown';

  if (!data) {
    return field;
  }

  if (!data.extra) {
    return field;
  }

  if (data.extra.textarea && data.extra.textarea.field) {
    field = data.extra.textarea.field;
  }

  return field;    
}

function scrollBottom(container) {
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }
}

export default function Chatbot() {
  const [messages, setMessages] = useState({});
  const [input, setInput] = useState('');
  const [config, setConfig] = useState(null);
  const [inputSettings, setInputSettings] = useState({});
  const core = useRef(null);

  const [formStorage, setFormStorage] = useState({});
  const [questionsStorage, setQuestionsStorage] = useState({});

  const [dateValue, setDateValue] = useState({
    startDate: new Date(),
    endDate: new Date().setMonth(11)
  });

  //https://landbot.online/v3/H-2084994-V8LM3LGSZ96U4UH0/index.html

  useEffect(() => {
    fetch('https://storage.googleapis.com/landbot.online/v3/H-2090338-JCG0PS6D9CGMQHWC/index.json')
      .then(res => res.json())
      .then(setConfig);
  }, []);

  useEffect(() => {
    if (config) {
      core.current = new Core(config);
      
      core.current.pipelines.$readableSequence.subscribe(data => {
        data.display = true;
        data.disabled = false;

        console.log('Subscribe:', data);        

        if (data && data.type == "multi_question" && data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
          var form = { ...formStorage[data.id] };

          if ( !form ) {
            form = {};
          }

          for(let i in data.rows) {
            let row = data.rows[i];
            let input = row.inputs[0];

            if (!input) {
              continue;
            }

            form = {
              ...form,
              [input.name]: {
                label: input.label,
                name: input.name,
                type: input.type,
                value: input.default || form[input.name] || '',
                error: input.error || false,     
                errorHighlight: input.error ? true : false           
              }
            };
          }

          setFormStorage({
            ...formStorage,
            [data.id]: form
          });          
        }

        if (data && data.type == "text" && data.extra && data.extra.id && data.extra.form && data.extra.form.elements && Array.isArray(data.extra.form.elements) && data.extra.form.elements.length > 0) {
          var { 
            id: form_id,
            form
          } = data.extra;

          //var forms = {};

          var _form = { ...questionsStorage };
          _form = { ..._form[form_id] };

          //var multiForm = { ...formStorage[form_id] };

          for(let i in form.elements) {
            let element = form.elements[i];

            let attribute = { ...element.attributes };

            if (!element || !attribute || !attribute.name) {
              continue;
            }            

            let value = attribute.defaultValue || '';

            if (!value && _form[attribute.name] && _form[attribute.name].value) {
              value = _form[attribute.name].value;
            }

            if (attribute.type == 'checkbox') {
              value = [];
            }

            if (!attribute.type && element.element) {
              attribute.type = element.element;
            }

            _form = {
              ..._form,
              [attribute.name]: {
                label: element.label,
                name: attribute.name,
                type: attribute.type || element.element || '',
                value: value,
                error: element.error || false,     
                errorHighlight: element.error ? true : false           
              }              
            };

            if (element.options) {
              _form = {
                ..._form,
                [attribute.name]: {
                  ..._form[attribute.name],
                  options: element.options
                }
              };
            }
          }              
          
          setQuestionsStorage({
            ...questionsStorage,
            [form_id]: { ..._form }
          });
        }

        //console.log('Message List:', messages);

        setMessages(messages => ({
          ...messages,
          [data.key]: parseMessage(data),
        }));
      });
  
      core.current.init().then(data => {
        let message = parseMessages(data.messages);

        setMessages(message);
      });
    }
  }, [config]);

  useEffect(() => {
    let list = Object.values(messages)
      .filter(messagesFilter)
      .sort((a, b) => b.timestamp - a.timestamp);

    if ( list && list.length > 1 /*&& list[0].author == list[1].author && list[0].author == 'bot'*/ ){
      
      if (list[0].type == 'multi_question' && list[0].type == list[1].type && list[0].rows && list[1].display) {
        
        for(let i in list[0].rows) {
          let row = list[0].rows[i];

          if (!row || !row.inputs || !Array.isArray(row.inputs)) {
            continue;
          }

          let input = row.inputs[0];

          if (input && input.error && list[0].author_type == 'bot' && list[1].display) {
            setMessages(_messages => ({
              ..._messages,
              [list[1].key]: { ...list[1], display: false, disabled: true }
            }));

            break;
          }
        }
      }

      if (list[1].type == 'multi_question' && list[0].type != 'multi_question' && !list[1].disabled) {
        setMessages(_messages => ({
          ..._messages,
          [list[1].key]: { ...list[1], disabled: true }
        }));
      }

      if ((list[1].type == 'text' && list[1].extra && list[1].extra.form)) {
        if ((list[0].type != 'text' || !list[0].extra || !list[0].extra.form) && !list[1].disabled) {
          let _setMessages = {
            [list[1].key]: { ...list[1], disabled: true }
          };

          if (list[0].author_type == "user" && !list[0].message) {
            _setMessages = {
              ..._setMessages,
              [list[0].key]: { ...list[0], disabled: true, display: false }
            };
          }

          setMessages(_messages => ({
            ..._messages,
            ..._setMessages
          }));
        }

      }
    }

    const container = document.getElementById('landbot-messages-container');

    scrollBottom(container);    

  }, [messages]);

  const submit = () => {
    if (input !== '' && core.current) {
      console.log('Input:', input);

      core.current.sendMessage({ message: input });

      setInput('');
    }
  };

  function mainInputHandler(e, field) {
    if (!field || field == 'unknown') {
      return;
    }

    if (field == 'date' && e && (e.startDate || e.startDate === null)) {
      e = {
        target: {
          value: e.startDate
        }
      }
    }

    if (!e || !e.target) {
      return;
    }

    let {
      value
    } = e.target;    

    if (field == 'name' || field == 'email' || field == 'text') {
      setInput(value);
      return;
    }

    if (field == 'number') {
      value = value.replace(/\D/g, '');
    }

    if (field == 'phone') {
      value = phoneInputMask(value);
    }

    if (field == 'date') {
      value = value.split('-').reverse().join('/');
      setInput(value);
      return;
    }

    setInput(value);
  }

  function buttonAction(core, data, index, lastMessage) {  
    if (!lastMessage || !core || !data || !data.buttons || !data.payloads) {
      return;
    }

    if (!data.payloads[index] || !data.buttons[index]) {
      return;
    }
  
    let payload = {
      type: 'button',
      message: data.buttons[index],
      payload: data.payloads[index]
    };  

    let message = {
      key: '_' + data.key,
      text: payload.message,
      author: 'user',
      timestamp: data.timestamp,
      type: 'text',      
    };    
    
    //console.log('Payload:', payload);

    setMessages(messages => ({
      ...messages,
      [message.key]: message,
    }));

    core.sendMessage({...payload});
  }

  function phoneInputMask(value) {
    var digits = value.replace(/\D/g, '');
  
    var finalValue = '';

    if (digits.length > 11){
      digits = digits.slice(0, 11);
    }

    if (digits.length > 10 && digits.length <= 11) {
      finalValue = digits.replace(/(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }else if (digits.length > 6 && digits.length <= 10) {
      finalValue = digits.replace(/(\d{2})(\d{4})(\d{1,4})/, '($1) $2-$3');
    }else if (digits.length > 2 && digits.length <= 6) {
      finalValue = digits.replace(/(\d{2})(\d{1,5})/, '($1) $2');
    }else if (digits.length > 0 && digits.length <= 2) {
      finalValue = digits.replace(/(\d{0,2})/, '($1');
    }
    return finalValue;
  }  

  function formatFormResponse(data, rows, core) {
    //console.log('Form Data:', data, rows)
    if (!data || !data.id || !rows || !Array.isArray(rows) || rows.length == 0) {
      return;
    }

    var form = { ...formStorage[data.id] };

    if ( !form ) {
      
      //return;
    }

    var response = {
      type: 'structured_data',
      message: '',
      data: {}
    };

    for(let i in rows) {
      let row = { ...rows[i] };

      if (!form[row.name]) {
        form[row.name] = {};
      }

      if (!form[row.name].value) {
        form[row.name].value = '';
      }

      let value = form[row.name].value || '';

      if (row.type == 'tel') {
        //value = value.replace(/\D/g, '');
      }

      if (row.type == 'date') {
        if (/^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/.test(value)) {
          value = value.split('-').reverse().join('/');
        }
      }

      response.data[row.name] = value;

      response.message += "**" + row.label + ":** " + value;

      if (i < rows.length - 1) {
        response.message += '\n';
      }
    }

    console.log('Form Response:', response);

    core.sendMessage(response)
  }

  function inputFormHandler(e, id, input) {
    //console.log('Event:', e);

    if (input && input.type == 'date' && e && (e.startDate || e.startDate === null)) {
      e = {
        target: {
          value: e.startDate
        }
      };
    }

    if ( !e || !e.target || !id || !input ) {
      return;
    }

    var { value } = e.target;

    if (input && input.type == 'number' && input.options) {
      let { 
        minValue, 
        maxValue 
      } = input.options;

      if (/^[0-9]{1,}$/.test(minValue) && parseInt(value) < parseInt(minValue)) {
        value = minValue;
      }

      if (/^[0-9]{1,}$/.test(maxValue) && parseInt(value) > parseInt(maxValue)) {
        value = maxValue;
      }     
    }

    if (input && input.type == 'tel') {
      value = phoneInputMask(value);
    }

    var form = { ...formStorage[id] };

    form = form[input.label];

    if ( !form  ){
      form = {
        name: input.name,
        label: input.label,
        type: input.type,
        value: value,
        error: input.error || false,
        errorHighlight: false,
      };
    }

    //console.log('A');

    setFormStorage({
      ...formStorage,
      [id]: { 
        ...formStorage[id], 
        [input.name]: {
          ...form,
          value: value,
          errorHighlight: false
        }
      }
    });
  }

  function renderButtons(data, lastMessage) {
    if ( !data || !data.type || data.type !== 'dialog' || !data.buttons ) {
      return (<></>);
    }

    if ( !Array.isArray(data.buttons) || data.buttons.length == 0 ) {
      return (<></>);
    }

    var btnClass = 'w-full';

    var {
      buttons,
      payloads,
      text,
      key
    } = data;

    if (!lastMessage) {
      buttons = [];
    }
  
    return (
      <article
        className="media landbot-message mb-2"
        key={key}
      >
        <div className="media-content landbot-message-content w-fit rounded-tr-[20px] rounded-tl-[20px] rounded-br-[20px] px-[15px] py-[8px] bg-[#41475E]">
          <div className="content">
            <p>{text}</p>
          </div>
        </div>
        <div className={`flex flex-wrap gap-2 text-center ${buttons.length > 0 ? 'mt-2' : 'mt-0' }`}>
          { buttons.map((button, index) => {
            return (
              <div 
                className={"flex-grow bg-[#D08406] rounded-[10px] px-[15px] py-[8px] text-white cusor-pointer min-w-[120px] cursor-pointer " + btnClass}
                onClick={()=>{ buttonAction(core.current, data, index, lastMessage) }}
              >
                { button }
              </div>
            );
          })}
        </div>
      </article>
    );
  } 

  function renderMediaDialog(data, lastMessage) {
    //console.log('Media Dialog:', data)
    //console.log('TESTE:', data.text)

    if ( !data || !data.type || data.type !== 'media_dialog' || !data.buttons ) {
      return (<></>);
    }

    if ( !Array.isArray(data.buttons) || data.buttons.length == 0 ) {
      return (<></>);
    }

    var btnClass = 'w-full';

    var {
      buttons,
      payloads,
      text,
      key
    } = data;

    //console.log(data.text)

    if (!lastMessage) {
      buttons = [];
    }    
  
    return (
      <article
        className="media landbot-message mb-2"
        key={key}
      >
        <div className="media-content landbot-message-content w-fit rounded-tr-[20px] rounded-tl-[20px] rounded-br-[20px] px-[15px] py-[15px] bg-[#41475E]">
          <div className="content">
            <img src={data.url} className="max-w-[250px]"/>
          </div>
        </div>
        <div className={`flex flex-wrap gap-2 text-center ${buttons.length > 0 ? 'mt-2' : 'mt-0' }`}>
          { buttons.map((button, index) => {
            return (
              <div 
                className={"flex-grow bg-[#D08406] rounded-[10px] px-[15px] py-[8px] text-white cusor-pointer min-w-[120px] cursor-pointer " + btnClass}
                onClick={()=>{ buttonAction(core.current, data, index, lastMessage) }}
              >
                { button }
              </div>
            );
          })}
        </div>
      </article>
    );
  } 

  function renderForm(data, lastMessage) {
    //console.log('Data:', data);

    console.log( 'Form:', formStorage, data.id );

    if ( !data || !data.type || data.type !== 'multi_question' || !data.rows || !data.display ) {
      return (<></>);
    }

    if ( !Array.isArray(data.rows) || data.rows.length == 0 ) {
      return (<></>);
    }

    const renderInputDate = (input, id) => {
      let { options } = input;

      if (!options){
        return (<></>);
      }

      let minDate = null;
      let maxDate = null;

      let format = 'DD/MM/YYYY';

      if (options.format && /^[a-zA-Z]{2,4}\/[a-zA-Z]{2,4}\/[a-zA-Z]{2,4}$/.test(options.format)) {
        format = options.format.toUpperCase();
      }

      if ( options.enabledDatesType && options.enabledDatesType == 'future' ) {
        minDate = new Date();
        
        if ( !options.includeCurrentDate ) {
          minDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
        }
      }

      if ( options.enabledDatesType && options.enabledDatesType == 'past' ) {
        maxDate = new Date();
        
        if ( !options.includeCurrentDate ) {
          maxDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
        }
      }  
      
      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: null,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        };         
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(form.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div 
            className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] ${(lastMessage ||  !data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'} ${form.errorHighlight ? 'border-red-500' : ''}`}
          >
            <Datepicker 
              placeholder={`${ input.placeholder ? input.placeholder : 'DD/MM/AAAA' }`}
              containerClassName="w-full h-full text-gray-700 relative"
              inputClassName="w-full h-full rounded-[5px] focus:ring-0 border-0 font-normal bg-transparent"
              asSingle={true}
              useRange={false} 
              value={{
                startDate: form.value, 
                endDate: form.value
              }} 
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
              i18n={"pt-br"} 
              displayFormat={format} 
              minDate={minDate} 
              maxDate={maxDate}
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      )
    };

    const renderInputNumber = (input, id) => {
      let { options } = input;

      let min = null;
      let max = null;

      if (/^[0-9]{1,}$/.test(options.minValue)){
        min = options.minValue;
      }

      if (/^[0-9]{1,}$/.test(options.maxValue)){
        max = options.maxValue;
      }

      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: '',
          error: input.error || false,
          errorHighlight: input.error ? true : false
        };         
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(form.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${form.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              placeholder={ `${ input.placeholder ? input.placeholder : '' }` }
              type="number"
              min={min}
              max={max}
              value={form.value}
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
              //disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      )
    };

    const renderAutocomplete = (input, id) => {
      let { buttons } = input;

      buttons = Object.values(buttons);

      //console.log('Autocomplete:', input.buttons)

      if (!buttons || !Array.isArray(buttons) || buttons.length == 0) {
        return (<></>);
      }

      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: null,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        };         
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(form.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${form.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <select
              className="w-full h-full px-[10px] py-0 border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0"
              value={form.value}
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
              disabled={data.disabled}
            >
              <option value="">Selecione</option>
              { buttons.map((button, index) => {
                //console.log(button);

                return (
                  <option value={button.text}>{button.text}</option>
                );
              })}
            </select>
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );
    };

    const renderInputPhone = (input, id) => {
      var form = formStorage[data.id] || {};

      form = form[input.name];

      if ( !form ) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: null,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        };         
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(form.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${form.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              value={form.value}
              placeholder={ `${input.placeholder ? input.placeholder : '(DD) 00000-0000'}` }
              onChange={(e)=>{ inputFormHandler(e, data.id, input); }} 
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      )
    }

    var {
      key,
      id,
      uuid,
      message,
      rich_text,
      rows 
    } = data;

    var rowsData = [];

    var formId = id || key || uuid;

    //console.log(rows);

    for(let i in rows) {
      let row = rows[i];

      if (!row || !row.inputs || !Array.isArray(row.inputs) || row.inputs.length == 0) {
        continue;
      }

      let input = { ...row.inputs[0] };

      let { extra } = input;

      if (!extra || (!extra.textarea && !extra.buttons) ) {
        continue;
      }

      delete input.extra;

      if (extra.textarea) {
        let { type, field } = extra.textarea;

        if (type == 'date') {
          input.options = { ...extra.textarea.dateOptions };
        }

        if (type == 'tel') {
          input.options = { ...extra.textarea };        
        }

        if (type == 'email') {
          input.options = { ...extra.textarea };                
        }

        if (type == 'number') {
          input.options = { ...extra.textarea }; 
        }

        if (type == 'text') {
          input.options = { ...extra.textarea };
        }

        if (type) {
          input._type = input.type;
          input.type = type;
        }

        if (field) {
          input.field = field
        }

        delete input.options.type;        
        delete input.options.field; 
      }

      if (extra.buttons) {
        let { type, field } = extra.buttons;

        if (type == 'autocomplete') {
          input.buttons = { ...extra.buttons.list };
        }

        if (type) {
          input._type = input.type;
          input.type = type;
        }

        if (field) {
          input.field = field
        }
      }

      rowsData[i] = input;
    }

    console.log('Rows:', rowsData);

    if (rowsData.length == 0) {
      return (<></>);
    }  
    
    return(
      <div
        className="w-full rounded-[10px] px-[15px] py-[15px] mb-[10px] bg-[#FFFFFF] drop-shadow-lg text-[16px] text-[#000000]"
      >
        <div className="text-[18px] mb-5 font-semibold">
          <div dangerouslySetInnerHTML={{ __html: rich_text }} />
        </div>
        {
          rowsData.map((input, index)=>{

            if (input.type == 'date') {
              return renderInputDate(input, formId);
            }

            if (input.type == 'number') {
              return renderInputNumber(input, formId);
            }

            if (input.type == 'autocomplete') {
              return renderAutocomplete(input, formId);
            }

            if (input.type == 'tel') {
              return renderInputPhone(input, formId);
            }

            var form = formStorage[id] || {};

            form = form[input.name];
        
            if ( !form ) {
              form = {
                name: input.name,
                label: input.label,
                type: input.type,
                value: null,
                error: input.error || false,
                errorHighlight: input.error ? true : false
              };         
            }

            //console.log('Input:', input)

            return(
              <div className={`text-[15px] mb-[10px] ${(form.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
                <div className="mb-[5px] ml-1 font-medium text-[14px] flex">
                  <span 
                    title="Campo obrigatório"
                    className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
                  >
                    *
                  </span>
                  {input.label}
                  <Tooltip 
                    text={input.help} 
                  />
                </div>
                <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${form.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
                  <input 
                    placeholder={ `${input.placeholder ? input.placeholder : ''}` }
                    className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
                    onChange={(e)=>{ inputFormHandler(e, data.id, input); }}
                    disabled={data.disabled}
                  />
                </div>
                <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
              </div>
            )
          })
        }
        <div 
          className={`w-full text-[14px] py-[8px] text-center rounded-[5px] bg-[#D08406] text-white cursor-pointer mt-5 ${data.disabled ? 'hidden' : ''}`}
          onClick={()=>{ formatFormResponse(data, rowsData, core.current); }}  
        >
          Enviar
        </div>
      </div>
    )
  }

  function getWeekNumber(date) {
    const currentDate = new Date(date);

    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

    const numberOfDays = Math.floor((currentDate - startOfYear) / (24 * 60 * 60 * 1000));
  
    const weekNumber = Math.ceil((numberOfDays + startOfYear.getDay() + 1) / 7);

    return weekNumber;
  }

  function inputQuestionHandler(e, input, form_id) {
    console.log('Input Question:', input, form_id);
    console.log('Target Event:', e, form_id)
    
    if (input && (input.type == 'date' || input.type == 'week') && e && (e.startDate || e.startDate === null)) {
      let value = e.startDate;

      if (/^[0-9]{2,4}\-[0-9]{2}\-[0-9]{2,4}$/.test(value) && input.type == 'date') {    
        //value = e.startDate.split('-').reverse().join('/');      
      }      
      
      e = { target: { value } };
    }

    if (!e || !e.target || !input || !form_id) {
      return;
    }

    let { value } = e.target;

    //if ()

    if (input.type == 'tel') {
      value = phoneInputMask(value);
    }

    //if (input.type == 'time') {
    //  value = 0;
    //}

    if (input.type == 'number') {
      value = value.replace(/\D/g, '');
    }

    if (input.type == 'week') {
      //value = '2024-W01';
    }

    if (input.type == 'checkbox') {
      let checked = e.target.checked;

      value = e.target.defaultValue;

      let form = { ...questionsStorage[form_id] };
      form = form[input.name];

      if (!form) {
        form = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: [],
          error: input.error || false,
          errorHighlight: false
        };
      }

      if (!Array.isArray(form.value)){
        form.value = [];
      }

      if (!checked) {
        form.value = form.value.filter((item) => { return item != value; });
      }
        
      if (checked && !form.value.includes(value)) {
        form.value.push(value);
      }

      console.log('Form:', form, value, checked)

      setQuestionsStorage({
        ...questionsStorage,
        [form_id]: { 
          ...questionsStorage[form_id], 
          [input.name]: {
            ...form,
            errorHighlight: false
          }
        }
      });

      return;
    }

    if (input.type == 'radio') {

    }

    let form = { ...questionsStorage[form_id] };

    form = form[input.name];

    if (!form) {
      form = {
        name: input.name,
        label: input.label,
        type: input.type,
        value: value,
        error: input.error || false,
        errorHighlight: false
      };
    }

    setQuestionsStorage({
      ...questionsStorage,
      [form_id]: { 
        ...questionsStorage[form_id], 
        [input.name]: {
          ...form,
          value: value,
          errorHighlight: false
        }
      }
    });
  }
  
  function formatQuestionResponse(elements, core, form_id) {
    //console.log('Form Data:', data, rows)
    if (!form_id || !core || !Array.isArray(elements) || elements.length == 0) {
      return;
    }

    var response = {
      type: 'text',
      payload: '',
      custom_data: {}
    };

    for(let i in elements) {
      let element = { ...elements[i] };

      let attributes = { ...element.attributes };

      let question = { ...questionsStorage };
      question = { ...question[form_id] };
      question = { ...question[attributes.name] };

      if (!question.value) {
        question.value = '';
      }

      if (attributes.type == 'checkbox' && !Array.isArray(question.value)) {
        question.value = [];
      }

      let value = question.value || '';

      if (question.type == 'tel') {
        value = value.replace(/\D/g, '');
      }

      if (question.type == 'time') {
        let _time = new Date(value);

        if (_time) {
          let year = _time.getFullYear();

          let week = getWeekNumber(value);
          week = week.toString().padStart(2, '0');
          
          value = year + '-W' + week;
        } else {
          value = '';
        }
      }

      response.custom_data[question.name] = value;
    }

    console.log('Form Response:', response);

    core.sendMessage(response);
  }

  function renderQuestions(data, lastMessage) {
    if (!data || !data.extra || !data.extra.form || !data.extra.form.elements) {
      return (<></>);
    }

    //console.log('Questions:', questionsStorage);

    let { elements } = data.extra.form;
    let { id: form_id } = data.extra;

    if (!Array.isArray(elements) || elements.length == 0) {
      return (<></>);
    }

    var {
      key,
      id,
      uuid,
      rich_text,
    } = data;

    var rowsData = [];

    for ( let i in elements ) {
      let _element = { ...elements[i] };

      let {
        attributes,
        element,
        label,
        help,
        options
      } = _element;

      let {
        defaultValue,
        name,
        placeholder,
        required,
        type
      } = attributes;

      let row = {
        type,
        name,
        element,
        label,
        required,
        value: defaultValue || '',
        placeholder: placeholder || '',
        help: help || false,
        options
      };

      rowsData.push(row);
    }

    const renderTextInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              value={question.value}
              placeholder={ `${input.placeholder ? input.placeholder : ''}` }
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      )
    }

    const renderEmailInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              value={question.value}
              placeholder={ `${input.placeholder ? input.placeholder : ''}` }
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      )
    }

    const renderPhoneInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              value={question.value}
              placeholder={ `${input.placeholder ? input.placeholder : '(DD) 00000-0000'}` }
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );
    }

    const renderDateInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value || null,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      let format = 'DD/MM/YYYY';

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
          <Datepicker 
              placeholder={`${ input.placeholder ? input.placeholder : 'DD/MM/AAAA' }`}
              containerClassName="w-full h-full text-gray-700 relative"
              inputClassName="w-full h-full rounded-[5px] focus:ring-0 border-0 font-normal bg-transparent"
              asSingle={true}
              useRange={false} 
              value={{
                startDate: question.value, 
                endDate: question.value
              }} 
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              i18n={"pt-br"} 
              displayFormat={format} 
              minDate={null} 
              maxDate={null}
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );      
    }

    const renderNumberInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <input 
              className="w-full h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              value={question.value}
              placeholder={ `${input.placeholder ? input.placeholder : ''}` }
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              type="number"
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );
    }

    const renderTextAreaInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-max border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <textarea 
              className="w-full px-[5px] py-[5px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0 resize-none" 
              placeholder={ `${ input.placeholder ? input.placeholder : '' }` }
              value={question.value}
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              rows="4"
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );
    }

    const renderCheckboxInput = (input, options) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      let checkboxs = [ ...options ];

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full`}> 
            {
              checkboxs.map((checkbox, index)=>{                
                return (
                  <div className="flex items-center mb-2">
                    <input
                      id={`${form_id}-${input.name}-${index}`}
                      type="checkbox"
                      value={question.value.includes(checkbox.value)}
                      className="w-4 h-4 rounded-[2px] mr-[6px] ml-[5px]"
                      onChange={(e)=>{ 
                        e.target.defaultValue = checkbox.value; 
                        inputQuestionHandler(e, input, form_id); 
                      }}
                      checked={question.value.includes(checkbox.value)}
                      disabled={data.disabled}
                    />
                    <label 
                      htmlFor={`${form_id}-${input.name}-${index}`}
                      className="text-[13px] font-normal"
                    >
                      {checkbox.text}
                    </label>
                  </div>
                );
              })
            }
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );
    }

    const renderSelectInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type || input.element || '',
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false,
          options: input.options || []
        }; 
      }      

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <select
              className="w-full h-full px-[10px] py-0 border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0"
              value={question.value}
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              disabled={data.disabled}
            >
              <option value="">Selecione</option>
              { question.options.map((button, index) => {
                //console.log(button);
                return (
                  <option value={button.value}>{button.text}</option>
                );
              })}
            </select>
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );
    }

    const renderRadioInput = (input, options) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false,
          options: input.options || []
        }; 
      }

      let radios = [ ...input.options ];

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full`}> 
            {
              radios.map((radio, index)=>{                
                return (
                  <div className="flex items-center mb-2">
                    <input
                      id={`${form_id}-${input.name}-${index}`}
                      name={`${form_id}-${input.name}`}
                      type="radio"
                      value={radio.value}
                      className="w-4 h-4 rounded-full mr-[6px] ml-[5px]"
                      onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }}
                      disabled={data.disabled}
                    />
                    <label 
                      htmlFor={`${form_id}-${input.name}-${index}`}
                      className="text-[13px] font-normal"
                    >
                      {radio.text}
                    </label>
                  </div>
                );
              })
            }
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );
    }

    const renderWeekInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value || null,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      let format = 'DD/MM/YYYY';

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
          <Datepicker 
              placeholder={`${ input.placeholder ? input.placeholder : 'DD/MM/AAAA' }`}
              containerClassName="w-full h-full text-gray-700 relative"
              inputClassName="w-full h-full rounded-[5px] focus:ring-0 border-0 font-normal bg-transparent"
              asSingle={true}
              useRange={false} 
              value={{
                startDate: question.value, 
                endDate: question.value
              }} 
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              i18n={"pt-br"} 
              displayFormat={format} 
              minDate={null} 
              maxDate={null}
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      );      
    }

    const renderColorInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <div
              className="w-full h-full focus:ring-0 border-0 bg-transparent flex"
            >
              <input 
                type="color"
                className="w-[55px] h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
                value={question.value}
                placeholder={ `${input.placeholder ? input.placeholder : ''}` }
                onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
                disabled={data.disabled}
              />
              <div
                className="h-fit w-fit my-auto text-[15px]"
              >
                {question.value}
              </div>              
            </div>
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      )
    }

    const renderTimeInput = (input) => {
      let forms = { ...questionsStorage };

      let questions = { ...forms[form_id] };

      let question = questions[input.name];

      if (!question) {
        question = {
          name: input.name,
          label: input.label,
          type: input.type,
          value: input.value,
          error: input.error || false,
          errorHighlight: input.error ? true : false
        }; 
      }

      return (
        <div className={`text-[15px] mb-[10px] ${(question.errorHighlight && !data.disabled) ? 'mb-[0px]' : ''}`}>
          <div className="mb-2 ml-1 font-medium text-[14px] flex">            
            <span 
              title="Campo obrigatório"
              className={`text-red-500 mr-[2px] font-bold ${input.required ? '' : 'hidden'}`}
            >
              *
            </span>
            {input.label}
            <Tooltip 
              text={input.help} 
            />
          </div>
          <div className={`w-full h-[35px] border-[1px] border-bluePrime rounded-[5px] bg-white ${question.errorHighlight ? 'border-red-500' : ''} ${(!data.disabled) ? 'bg-white' : 'bg-[#000000]/[0.1] border-[#000000]/[0.15]'}`}>
            <input 
              type="time"
              className="w-fit h-full px-[10px] border-0 outline-none text-[15px] font-normal bg-transparent focus:ring-0" 
              value={question.value}
              placeholder={ `${input.placeholder ? input.placeholder : ''}` }
              onChange={(e)=>{ inputQuestionHandler(e, input, form_id); }} 
              disabled={data.disabled}
            />
          </div>
          <div className={`w-full text-right text-red-500 text-[12px] mb-0 ${(input.error && !data.disabled) ? '' : 'hidden'}`}>{input.error}</div>
        </div>
      )
    }

    return(
      <div
        className="w-full rounded-[10px] px-[15px] py-[15px] mb-[10px] bg-[#FFFFFF] drop-shadow-lg text-[16px] text-[#000000]"
      >
        <div className="text-[18px] mb-5 font-semibold">
          <div dangerouslySetInnerHTML={{ __html: rich_text }} />
        </div>
        {
          rowsData.map((input, index)=>{
            let {
              type,
              name,
              element,
              label,
              required,
              value,
              placeholder,
              help,
              options
            } = input;

            if (type == 'text') {
              return renderTextInput(input);
            }

            if (type == 'email') {
              return renderEmailInput(input);
            }

            if (type == 'tel') {
              return renderPhoneInput(input);
            }

            if (type == 'number') {
              return renderNumberInput(input);
            }

            if (type == 'date') {
              return renderDateInput(input);
            }

            if (element == 'textarea') {
              return renderTextAreaInput(input);
            }

            if (type == 'checkbox') {
              return renderCheckboxInput(input, options);
            }

            if (element == 'select') {
              return renderSelectInput(input);
            }

            if (element == 'radion' || type == 'radio') {
              return renderRadioInput(input);
            }

            if (element == 'week' || type == 'week') {
              return renderWeekInput(input);
            }

            if (element == 'color' || type == 'color') { 
              return renderColorInput(input);
            }

            if (type == 'time') {
              return renderTimeInput(input);
            }
            
            return (
              <></>
            );
          })
        }
        <div 
          className={`w-full text-[14px] py-[8px] text-center rounded-[5px] bg-[#D08406] text-white cursor-pointer mt-5 ${data.disabled ? 'hidden' : ''}`}
          onClick={()=>{ formatQuestionResponse(elements, core.current, form_id) }}  
        >
          Enviar
        </div>
      </div>
    );
  }

  function renderMainInput(field, data, disableInput, disableSubmit) {
    if (field == 'date') {
      let startDate = input;
      let endDate = input;

      let minDate = null;
      let maxDate = null;

      let format = 'DD/MM/YYYY';

      if (data.extra && data.extra.textarea && data.extra.textarea.dateOptions) {
        let { dateOptions } = data.extra.textarea;

        if (dateOptions.format && /^[a-zA-Z]{2,4}\/[a-zA-Z]{2,4}\/[a-zA-Z]{2,4}$/.test(dateOptions.format)) {
          format = dateOptions.format.toUpperCase();
        }

        if ( dateOptions.enabledDatesType && dateOptions.enabledDatesType == 'future' ) {
          minDate = new Date();
          
          if ( !dateOptions.includeCurrentDate ) {
            minDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
          }
        }

        if ( dateOptions.enabledDatesType && dateOptions.enabledDatesType == 'past' ) {
          maxDate = new Date();
          
          if ( !dateOptions.includeCurrentDate ) {
            maxDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
          }
        }
      }

      console.log('Date Data:', data);

      return (
        <Datepicker 
          placeholder={`${ input.placeholder ? input.placeholder : 'DD/MM/AAAA' }`}
          containerClassName="w-full h-full text-gray-700 relative"
          inputClassName={`w-full h-full rounded-[5px] focus:ring-0 border-0 font-normal bg-transparent outline-0 py-[20px] pl-[25px] pr-[55px] text-[16px] text-white font-normal outline-none focus:ring-0 ${disableInput ? 'cursor-not-allowed' : ''}`}
          toggleClassName="hidden"
          asSingle={true}
          useRange={false} 
          value={{
            startDate: startDate, 
            endDate: endDate
          }} 
          onChange={(e)=>{ mainInputHandler(e, field); }} 
          i18n={"pt-br"} 
          displayFormat={format} 
          minDate={minDate} 
          maxDate={maxDate}
          disabled={disableInput ? true : false}
        />
      );
    }

    return (              
      <input
        className={`landbot-input bg-transparent border-0 outline-0 py-[20px] pl-[25px] pr-[55px] cursor-text text-[16px] font-normal text-left w-full outline-none focus:ring-0 ${disableInput ? 'cursor-not-allowed' : ''}`}
        onChange={e => mainInputHandler(e, field)}
        onKeyUp={e => {
          if (e.key === 'Enter' && !disableSubmit) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type here..."
        type="text"
        value={input}
        disabled={disableInput ? true : false}
      />
    );
  }

  /*
    - Verificar o tipo de mensagem
    - Imprimir botões
    - Responder mensagem com botão
    - Bloquear enviar se tiver botões
  */ 

  const MessageArray = 
    Object.values(messages)
      .filter(messagesFilter)
      .sort((a, b) => a.timestamp - b.timestamp); 

  var disableInput = true;
  var disableSubmit = true;

  if (MessageArray.length > 0) {
    var messageData = MessageArray[MessageArray.length - 1];
    var messageField = getMessageField(messageData);

    //console.log('Message Field:', messageField)

    if (messageField == 'name' || messageField == 'number' || messageField == 'email' || messageField == 'text') {
      disableInput = false;
      disableSubmit = false;
    }    

    if (messageField == 'date') {
      console.log(input)
      let datePattern = /^[0-9]{2,4}\/[0-9]{2}\/[0-9]{2,4}$/;

      disableInput = false;
      disableSubmit = !datePattern.test(input);
    }
    
    if (messageField == 'phone') {
      let phonePattern = /^\([0-9]{2}\)\s[0-9]{4,5}-[0-9]{4}$/;
      
      disableInput = false;
      disableSubmit = !phonePattern.test(input);
    }

    if (input.length == 0) {
      disableSubmit = true;
    }
  }

  //console.log('Messages:', MessageArray);  
  console.log('Questions:', questionsStorage)

  return (
    <div className='w-[425px] h-[550px] mx-auto rounded-[20px] bg-[#2C2F40] flex flex-col'>
      <div className="landbot-header font-montserrat px-[30px] py-[15px] bg-[#41475E] rounded-tl-[20px] rounded-tr-[20px] outline-0">
        <h1 className="subtitle leanding-[22px] font-normal text-white text-[20px]">Landbot Teste</h1>
      </div>

      <div
        className="landbot-messages-container leading-5 px-[10px] py-[36px] text-[16px] grow shrink basis-0 text-white scroll-px-0"
        id="landbot-messages-container"
        style={{ overflow: 'auto', scrollbarGutter: 'stable both-edges' }}
      >
        { MessageArray.map((message, index) => {      

            //console.log('_Message:', MessageArray, MessageArray.length);

            let lastMessage = MessageArray.length - 1 == index;

            let authorClass = message.author == 'user' ? ' rounded-bl-[20px] bg-[#D08406] ml-auto' : ' rounded-br-[20px] bg-[#41475E]';
            
            //console.log(message, lastMessage);

            if ( getMessageType(message) == 'multi_question') {
              return renderForm(message, lastMessage);
            }

            if ( getMessageType(message) == 'text' && message.extra && message.extra.form ) {
              return renderQuestions(message, lastMessage);
            }

            if ( getMessageType(message) == 'text' && message.author_type == "user" && !message.text && !message.display  ) {
              return (<></>);
            }

            if ( getMessageType(message) == 'media_dialog' && lastMessage && !inputSettings.disabled) {
              setInputSettings({...inputSettings, disabled: true});
            }

            if ( getMessageType(message) == 'media_dialog' ) {
              //console.log('_Media Dialog:', message)
              let nextMessage = MessageArray[index + 1];

              if ( !lastMessage && nextMessage && nextMessage.type == 'media_dialog' && nextMessage.url == message.url) {
                return (<></>);
              } 

              return renderMediaDialog(message, lastMessage);
            }

            if ( getMessageType(message) == 'dialog' && lastMessage && !inputSettings.disabled) {
              setInputSettings({...inputSettings, disabled: true});
            }

            if ( getMessageType(message) == 'dialog' ) {              
              return renderButtons(message, lastMessage);
            }           

            return(
              <article
                className="media landbot-message mb-2"
                data-author={message.author}
                key={message.key}
              >
                <div className={"media-content landbot-message-content w-fit rounded-tr-[20px] rounded-tl-[20px] px-[15px] py-[8px]" + authorClass}>
                  <div className="content">
                    <p>{message.text}</p>
                  </div>
                </div>
              </article>
            );
          })}
      </div>

      <div className="landbot-input-container mt-auto bg-[#41475E] rounded-bl-[20px] rounded-br-[20px] outline-0 relative text-[16px] text-white">
        <div className="field">
          <div className="control">
            {
              renderMainInput(messageField, MessageArray[MessageArray.length - 1], disableInput, disableSubmit)
            }
            <button
              className={`button landbot-input-send h-[36px] leading-[24px] flex px-[12px] py-[6px] background-transparent border-transparent absolute right-[20px] top-[50%] transform translate-y-[-50%] text-[#D08406] rounded-[5px] outline-none bg-[#FFFFFF]/[0.1] ${(disableInput || !input || disableSubmit) ? ' opacity-60 cursor-not-allowed' : ' opacity-100 cursor-pointer'} `}
              //disabled={input === ''}
              //onClick={submit}
              onClick={() => { 
                console.log(formStorage); 

                if (disableSubmit){ 
                  return; 
                }

                submit(); 
              }}
              type="button"
            >
              <span className={`icon is-large m-auto text-[25px] ${(disableInput || !input || disableSubmit) ? 'opacity-70' : 'opacity-100'}`}>
                ➤
              </span>
            </button>
          </div>
        </div>
      </div>
      <div 
        className="p-3 bg-bluePrime text-white cursor-pointer mt-5"
        onClick={()=>{ console.log(MessageArray); }}
      >Mensagens</div>
    </div>
  );
}