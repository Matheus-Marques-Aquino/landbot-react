import React, { useEffect, useRef, useState } from 'react';
import { MdOpenInNew } from "react-icons/md";

export default function PlanCard({ plan_id, name, price, is, coverages }) {
    const [planData, setPlanData] = useState({
        id: 0,
        name: '',
        price: '',
        is: {
            currency: '',
            value: ''
        },
        installments: {
            number: '',
            value: ''
        },
        coverages: []
    });

    const valueOptions = {  
        style: 'decimal', 
        useGrouping: true, 
        groupingSeparator: '.', 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    };

    useEffect(() => {
        var plan = {
            id: plan_id || 0,
            name: name || '',
            price: price || '',
            is: {
                currency: '',
                value: ''
            },
            installments: {
                number: '',
                value: ''
            },
            coverages: []
        };
        
        price = parseInt(price);
        price = price / 100;

        let installments = {
            number: 1,
            value: price
        };

        for(let i = 1; i <= 12; i++) {
            if (installments.price / i >= 1) {
                installments.number = i;
                installments.value = installments.price / i;
            }else{
                break;
            }
        }

        price = price.toLocaleString('pt-BR', { ...valueOptions });
        installments.value = installments.value.toLocaleString('pt-BR', { ...valueOptions });

        plan.price = price;
        plan.installments = installments;  
        
        plan.is.value = is.value;
        plan.is.currency = 'R$';

        for(let i in coverages) {
            let { title, is } = coverages[i];

            is.value = is.value.replace(/\D/g, '');
            is.value = parseInt(is.value);
            is.value = is.value / 100;

            if (is.value > 0) {
                is.value = is.value.toLocaleString('pt-BR', { ...valueOptions });
            }else{
                is.value = '';
            }

            if (is.currency == "BRL") {
                is.currency = "R$";
            }

            if (is.currency == "USD") {
                is.currency = "$";
            }

            let coverage = {
                title,
                value: is.value,
                currency: is.currency   
            } 
            
            plan.coverages.push( coverage );
        }

        setPlanData({...plan});
    }, []);
    
    return (
        <div
            className="w-[190px] min-w-[190px] mx-auto px-[10px] py-[10px] h-fit bg-white border-[1px] border-[#000000]/[0.05] font-medium rounded-[8px] shadow-lg"
        >
            <div
                className="w-full h-fit text-center text-[#000] font-semibold text-[14px] opacity-80"
            >
                PRIME BR 15
            </div>
            <div
                className="w-full h-fit text-center text-[#333] mt-4"
            >
                <div
                    className="w-fit h-fit mx-auto text-[#000] text-[16px] flex"
                >
                    <div className="mr-[3px] mt-auto text-[12px] leading-[14px]">12x</div>
                    <div className="mr-[4px] leading-[16px]">
                        <span className="mr-[2px]">R$</span>
                        <span className="">30,37</span>
                    </div>
                    <div className="mt-auto text-[11px] leading-[13px]">Sem Juros</div>
                </div>
            </div>
            <div
                className="w-fit h-fit mx-auto text-[12px] text-[#000] flex"
            >
                <span className="mr-[4px]">Valor a vista</span>
                <span className="text-[13px] mr-[2px] font-semibold">R$</span>
                <span className="text-[13px] font-semibold">364,44</span>
            </div>
            <div
                className="w-fit mx-auto mt-3 h-fit text-center text-[#000] text-[13px]"
            >
                Cobertura Total:
            </div>
            <div
                className="w-fit mx-auto h-fit text-center text-[#03a8db] text-[14px] flex leading-[14px] mt-[3px]"
            >
                <span className="mr-[2px] font-semibold">R$</span>
                <span className="font-semibold">15.000,00</span>
            </div>
            <div
                className="w-full h-fit py-[4px] rounded-[5px] mt-3 text-[13px] text-center font-semibold cursor-pointer text-[#03A8DB] flex text-center justify-center items-center"
            >
                <MdOpenInNew className="my-auto"/>
                <span
                    className="ml-[4px]"
                >
                    Exibir Coberturas
                </span>

            </div>
            <div
                className="w-full h-fit py-[4px] rounded-[5px] mt-3 text-[13px] text-center font-semibold cursor-pointer text-white bg-[#03A8DB]"
            >
                Selecionar Plano
            </div>
        </div>
    );
}